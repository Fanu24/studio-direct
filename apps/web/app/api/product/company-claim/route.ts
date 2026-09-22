import {appOrigin,currentUser,platform,sameOrigin} from '../../../../lib/platform';
import {requireTenantId} from '../../../../lib/tenant';
import {loadProductFlags} from '../../../../lib/product/flags';
import {claimOrderById,createCompanyClaimOrder,fulfillCompanyClaim} from '../../../../lib/product/company-claims';
import {stripeRead} from '../../../../lib/billing/invoices';
import {reversePayment} from '../../../../lib/billing/reversals';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:'Invalid request origin.'},{status:403});
  const env = await platform(), user = await currentUser(env,request), tenant = await requireTenantId(env.DB);
  if (!user) return Response.json({error:'Sign in before claiming a company.',login:'/employer/login?next=/claim-company'},{status:401});
  const flags = await loadProductFlags(env.DB,tenant,env);
  if (!flags.PRODUCT_COMPANY_CLAIMS) return Response.json({error:'Not found.'},{status:404});
  if (env.STRIPE_ENABLED !== 'true' || !env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) return Response.json({error:'Test checkout is not configured.'},{status:503});
  let raw: {id?:unknown;companyId?:unknown;companyUrl?:unknown;action?:unknown};
  try {raw = await request.json();} catch {return Response.json({error:'Invalid request.'},{status:400});}
  if (!raw || typeof raw.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(raw.id)) return Response.json({error:'Invalid claim request.'},{status:400});
  if (raw.action === 'reconcile') {
    const order = await claimOrderById(env.DB,raw.id);
    if (!order || order.user_id !== user.id || order.tenant_id !== tenant) return Response.json({error:'Claim not found.'},{status:404});
    if (!order.stripe_session_id) return Response.json({error:'This claim does not have a checkout session yet.'},{status:409});
    const session = await stripeRead(env.STRIPE_SECRET_KEY,'checkout/sessions/'+encodeURIComponent(order.stripe_session_id));
    if (session.metadata?.claimOrderId !== order.id || session.livemode !== false) return Response.json({error:'Checkout identity mismatch.'},{status:409});
    if (session.payment_intent) {
      const payment = await stripeRead(env.STRIPE_SECRET_KEY,'payment_intents/'+encodeURIComponent(session.payment_intent)+'?expand[]=latest_charge');
      if (payment.latest_charge?.refunded) await reversePayment(env.DB,session.payment_intent,'reconcile:refund:'+session.payment_intent);
    }
    if (session.status === 'expired') await env.DB.prepare("UPDATE company_claim_orders SET status='expired' WHERE id=? AND status='pending'").bind(order.id).run();
    else await fulfillCompanyClaim(env.DB,session,'reconcile:'+session.id);
    return Response.json({status:(await claimOrderById(env.DB,order.id))?.status});
  }
  if (typeof raw.companyId !== 'string' || typeof raw.companyUrl !== 'string') return Response.json({error:'Choose the company and its website.'},{status:400});
  let order;
  try {order = await createCompanyClaimOrder(env.DB,{id:raw.id,tenantId:tenant,userId:user.id,companyId:raw.companyId,companyUrl:raw.companyUrl});}
  catch (error) {return Response.json({error:error instanceof Error ? error.message : 'Invalid company claim.'},{status:400});}
  if (order.status !== 'pending') return Response.json({error:'This claim checkout is already processed.'},{status:409});
  const origin = appOrigin(env);
  const body = new URLSearchParams({mode:'payment',customer_email:user.email,success_url:`${origin}/employer/claims?order=${order.id}`,cancel_url:`${origin}/claim-company?cancelled=1`,
    'metadata[claimOrderId]':order.id,'payment_intent_data[metadata][claimOrderId]':order.id,
    'line_items[0][quantity]':'1','line_items[0][price_data][currency]':order.currency,'line_items[0][price_data][unit_amount]':String(order.total_cents),
    'line_items[0][price_data][product_data][name]':'Nodework company page claim (no job posts)',allow_promotion_codes:'true',billing_address_collection:'required'});
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`company-claim:${order.id}`},body,signal:AbortSignal.timeout(15000)});
  if (!response.ok) return Response.json({error:'Payment provider unavailable. Retry this claim.'},{status:502});
  const session = await response.json() as {id:string;url:string;livemode:boolean};
  if (!session.id || !session.url?.startsWith('https://checkout.stripe.com/') || session.livemode !== false) return Response.json({error:'Invalid test checkout response.'},{status:502});
  await env.DB.prepare('UPDATE company_claim_orders SET stripe_session_id=? WHERE id=? AND stripe_session_id IS NULL').bind(session.id,order.id).run();
  return Response.json({url:session.url});
}
