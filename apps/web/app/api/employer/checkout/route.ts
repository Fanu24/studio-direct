import { platform,currentUser,sameOrigin,appOrigin } from '../../../../lib/platform';
import { requireTenantId } from '../../../../lib/tenant';
import { parseSelection } from '../../../../lib/billing/listing-catalog';
import { parseListing } from '../../../../lib/billing/listing-input';
import { createEmployerOrder } from '../../../../lib/billing/employer-orders';

export async function POST(request:Request) {
  if(!sameOrigin(request))return Response.json({error:'Invalid request origin'},{status:403});
  const env=await platform(),user=await currentUser(env,request);
  if(!user)return Response.json({error:'Sign in to post a job',login:'/login?next=/post-web3-job'},{status:401});
  if(env.STRIPE_ENABLED!=='true'||!env.STRIPE_SECRET_KEY)return Response.json({error:'Checkout is not configured yet'},{status:503});
  let raw;
  try{raw=await request.json();}catch{return Response.json({error:'Invalid request'},{status:400});}
  if(!raw||!['job','bundle'].includes(raw.kind)||typeof raw.id!=='string'||!/^[a-f0-9-]{36}$/i.test(raw.id))return Response.json({error:'Invalid order'},{status:400});
  let order;
  try{
    const selection=parseSelection(raw.selection,raw.kind);
    const listing=raw.kind==='job'?parseListing(raw.listing,user.email):null;
    if(listing&&selection.logo&&!listing.logoUrl)throw new Error('Upload a logo or deselect the logo option');
    order=await createEmployerOrder(env.DB,{id:raw.id,tenantId:await requireTenantId(env.DB),userId:user.id,kind:raw.kind,listing,selection});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Invalid order'},{status:400});}
  if(order.status!=='pending')return Response.json({error:'This order is already processed'},{status:409});
  const options=JSON.parse(order.selection_json),origin=appOrigin(env);
  const body=new URLSearchParams({mode:options.autoRenew?'subscription':'payment',customer_email:user.email,
    success_url:`${origin}/employer?order=${order.id}`,cancel_url:`${origin}/post-web3-job?cancelled=1`,
    'metadata[orderId]':order.id,'line_items[0][quantity]':'1','line_items[0][price_data][currency]':'usd',
    'line_items[0][price_data][unit_amount]':String(order.total_cents),
    'line_items[0][price_data][product_data][name]':order.kind==='bundle'?`Nodework ${options.quantity} job credits`:'Nodework job listing',
    allow_promotion_codes:'true','billing_address_collection':'required'});
  if(options.autoRenew){body.set('line_items[0][price_data][recurring][interval]','day');body.set('line_items[0][price_data][recurring][interval_count]','30');body.set('subscription_data[metadata][orderId]',order.id);}
  if(!options.autoRenew)body.set('payment_intent_data[metadata][orderId]',order.id);
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,
    'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`employer:${order.id}`},body});
  if(!response.ok)return Response.json({error:'Payment provider unavailable; retry this order'},{status:502});
  const session=await response.json() as {id:string;url:string};
  if(!session.id||!session.url?.startsWith('https://checkout.stripe.com/'))return Response.json({error:'Invalid checkout response'},{status:502});
  await env.DB.prepare(`UPDATE employer_orders SET stripe_session_id=? WHERE id=? AND stripe_session_id IS NULL`).bind(session.id,order.id).run();
  return Response.json({url:session.url});
}
