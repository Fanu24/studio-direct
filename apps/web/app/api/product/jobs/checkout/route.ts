import {PostingValidationError} from '@gaming/shared';
import {platform,currentUser,sameOrigin,appOrigin} from '../../../../../lib/platform';
import {requireTenantId} from '../../../../../lib/tenant';
import {loadProductFlags} from '../../../../../lib/product/flags';
import {createNativeOrder,nativeSelection} from '../../../../../lib/product/native-orders';
import {orderById} from '../../../../../lib/billing/employer-orders';
import {reconcileOrder} from '../../../../../lib/billing/reconcile-order';
import {recoverProductCheckout} from '../../../../../lib/product/checkout-recovery';

export async function POST(request:Request) {
  if(!sameOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
  const env=await platform(),user=await currentUser(env,request);
  if(!user)return Response.json({error:'Sign in to continue. Your draft is saved in this browser tab.',login:'/employer/login?next=/post-web3-job'},{status:401});
  const tenantId=await requireTenantId(env.DB);
  if(env.STRIPE_ENABLED!=='true'||!env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))return Response.json({error:'Test checkout is not configured.'},{status:503});
  let raw;
  try{raw=await request.json();}catch{return Response.json({error:'Invalid request.'},{status:400});}
  if(!raw||typeof raw.id!=='string'||!/^[a-f0-9-]{36}$/i.test(raw.id))return Response.json({error:'Invalid order.'},{status:400});
  if(raw.action==='reconcile'){
    const order=await orderById(env.DB,raw.id);
    if(!order||order.user_id!==user.id||order.tenant_id!==tenantId||order.offer_version!==2)return Response.json({error:'Order not found.'},{status:404});
    try{await reconcileOrder(env.DB,env.STRIPE_SECRET_KEY,order.id);return Response.json({status:(await orderById(env.DB,order.id))?.status});}
    catch{return Response.json({error:'Unable to confirm payment. Please try again or contact support.'},{status:502});}
  }
  const flags=await loadProductFlags(env.DB,tenantId,env);
  if(!flags.PRODUCT_POSTING_V2)return Response.json({error:'Not found.'},{status:404});
  let order;
  try{order=await createNativeOrder(env.DB,{id:raw.id,tenantId,userId:user.id,listing:raw.listing,addons:raw.addons,flags});}
  catch(error){return Response.json({error:error instanceof Error?error.message:'Invalid job.',...(error instanceof PostingValidationError?{fields:error.fields}:{})},{status:400});}
  const {quote}=nativeSelection(order),origin=appOrigin(env);
  const statusUrl=`${origin}/employer/purchase?order=${order.id}`;
  const expired=()=>Response.json({error:'This checkout expired. Your draft is saved. Click Continue again to open a new checkout.',restart:true},{status:409});
  if(order.status==='cancelled')return expired();
  if(order.status!=='pending')return Response.json({url:statusUrl});
  if(order.stripe_session_id)try{
    const recovery=await recoverProductCheckout(env.STRIPE_SECRET_KEY,order.stripe_session_id,order.id,'orderId',statusUrl);
    if(!recovery.expired)return Response.json({url:recovery.url});
    await env.DB.prepare("UPDATE employer_orders SET status='cancelled' WHERE id=? AND status='pending' AND stripe_session_id=?").bind(order.id,order.stripe_session_id).run();
    return expired();
  }catch{return Response.json({error:'Unable to check the existing payment. Please retry; no additional checkout was created.'},{status:502});}
  const body=new URLSearchParams({mode:'payment',customer_email:user.email,success_url:`${origin}/employer/purchase?order=${order.id}`,cancel_url:`${origin}/post-web3-job?cancelled=1`,
    'metadata[orderId]':order.id,'payment_intent_data[metadata][orderId]':order.id,allow_promotion_codes:'true',billing_address_collection:'required'});
  const labels={job:`Nodework job post (${quote.durationDays} days, company claim included)`,hide_salary:'Hide salary range',pin:'Pinned placement',early_access:'Early Access',confidential:'Confidential post'};
  quote.lines.filter(line=>line.amountCents>0).forEach((line,index)=>{
    const prefix=`line_items[${index}]`;
    body.set(`${prefix}[quantity]`,'1');body.set(`${prefix}[price_data][currency]`,order.currency);
    body.set(`${prefix}[price_data][unit_amount]`,String(line.amountCents));
    body.set(`${prefix}[price_data][product_data][name]`,labels[line.code]+(line.code==='pin'?` (${line.durationDays} days)`:''));
  });
  try{
    const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`native-job:${order.id}`},body,signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Provider unavailable');
    const session=await response.json() as {id:string;url:string;livemode:boolean};
    if(!session.id||!session.url?.startsWith('https://checkout.stripe.com/')||session.livemode!==false)throw Error('Invalid test checkout');
    await env.DB.prepare('UPDATE employer_orders SET stripe_session_id=? WHERE id=? AND stripe_session_id IS NULL').bind(session.id,order.id).run();
    if((await orderById(env.DB,order.id))?.stripe_session_id!==session.id)throw Error('Checkout identity mismatch');
    return Response.json({url:session.url});
  }catch{return Response.json({error:'Payment provider unavailable. Your draft is saved; retry this order.'},{status:502});}
}
