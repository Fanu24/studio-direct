import {pricing,publicHttpsUrl,normalizeCompanyName,type CompanyPlanTier,type ProductFlags} from '@gaming/shared';
import {appOrigin,type Database,type PlatformEnv,type Statement} from '../platform';
import {companyPurchaseStatements,canManageCompany} from './company-claims';
import {companyPlan} from './company-plans';

type StripeObject=Record<string,any>;
export type ProductOrder={id:string;tenant_id:string;user_id:string|null;company_id:string|null;kind:'company_plan'|'candidate_premium'|'verification'|'invite_pack'|'extension';choice:string;payload_json:string;total_cents:number;currency:string;status:string;stripe_session_id:string|null;stripe_subscription_id:string|null;stripe_customer_id:string|null;stripe_payment_intent_id:string|null};
const objectId=(v:any):string|null=>typeof v==='string'?v:typeof v?.id==='string'?v.id:null;
export async function productOrder(db:Database,id:string){return db.prepare('SELECT * FROM product_orders WHERE id=?').bind(id).first<ProductOrder>();}
export async function stripeProductRequest(secret:string,path:string,body?:URLSearchParams,idempotency?:string):Promise<StripeObject>{
 if(!secret.startsWith('sk_test_'))throw Error('Only Stripe sandbox is allowed.');
 const response=await fetch('https://api.stripe.com/v1/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+secret,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idempotency?{'Idempotency-Key':idempotency}:{})},body,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Stripe is unavailable. Please retry.');const result=await response.json() as StripeObject;if(result.livemode===true)throw Error('Live billing is disabled.');return result;
}
async function purchaseCompany(db:Database,tenantId:string,userId:string,raw:Record<string,unknown>,now:Date){
 const url=publicHttpsUrl(raw.companyUrl),name=String(raw.companyName??'').trim();if(!url)throw Error('Enter the company HTTPS website.');const domain=new URL(url).hostname.replace(/^www\./,'');
 let company=raw.companyId?await db.prepare('SELECT id,name,domain FROM companies WHERE id=? AND tenant_id=?').bind(raw.companyId,tenantId).first<{id:string;name:string;domain:string}>():await db.prepare('SELECT id,name,domain FROM companies WHERE tenant_id=? AND domain=?').bind(tenantId,domain).first<{id:string;name:string;domain:string}>();
 if(!company){if(name.length<2||name.length>160)throw Error('Enter the company name.');const id='draft-company:'+crypto.randomUUID();await db.prepare('INSERT OR IGNORE INTO companies(id,tenant_id,name,name_norm,domain,listed,pending_publication,created_at) VALUES(?,?,?,?,?,0,1,?)').bind(id,tenantId,name,normalizeCompanyName(name),domain,now.toISOString()).run();company=await db.prepare('SELECT id,name,domain FROM companies WHERE tenant_id=? AND name_norm=?').bind(tenantId,normalizeCompanyName(name)).first();}
 if(!company||company.domain?.replace(/^www\./,'')!==domain)throw Error('Company website mismatch. Contact support to correct the company identity.');
 const owner=await db.prepare("SELECT user_id FROM company_claims WHERE company_id=? AND status='approved'").bind(company.id).first<{user_id:string}>();if(owner&&owner.user_id!==userId)throw Error('Only this company’s verified owner can purchase its plan.');
 return {id:company.id,name:company.name,url};
}
export async function createProductOrder(db:Database,input:{id:string;tenantId:string;userId:string;kind:ProductOrder['kind'];choice:string;payload:Record<string,unknown>;flags:ProductFlags},now=new Date()){
 const user=await db.prepare('SELECT email_verified FROM users WHERE id=? AND tenant_id=?').bind(input.userId,input.tenantId).first<{email_verified:number}>();if(!user?.email_verified)throw Error('Verify your email before purchasing.');
 const existing=await productOrder(db,input.id);if(existing){if(existing.user_id!==input.userId||existing.tenant_id!==input.tenantId||existing.kind!==input.kind||existing.choice!==input.choice||JSON.stringify(JSON.parse(existing.payload_json).request)!==JSON.stringify(input.payload))throw Error('Submission ID already used. Start a new purchase.');return existing;}
 let amount:number,companyId:string|null=null,payload:Record<string,unknown>={request:input.payload};
 if(input.kind==='company_plan'){
  if(!input.flags.PRODUCT_COMPANY_PLANS||!Object.hasOwn(pricing.plans,input.choice))throw Error('Choose an available annual plan.');
  const company=await purchaseCompany(db,input.tenantId,input.userId,input.payload,now);companyId=company.id;payload={...payload,company};
  if(await companyPlan(db,companyId,now)||await db.prepare("SELECT company_id FROM company_plans WHERE company_id=? AND status NOT IN ('canceled','unpaid','incomplete_expired','refunded')").bind(companyId).first())throw Error('This company already has a subscription. Manage it in Billing.');
  amount=pricing.plans[input.choice as CompanyPlanTier].price;
 }else if(input.kind==='candidate_premium'){
  if(!input.flags.PRODUCT_CANDIDATE_PREMIUM||!['monthly','annual'].includes(input.choice))throw Error('Choose monthly or annual Premium.');
  if(await db.prepare("SELECT user_id FROM candidate_subscriptions WHERE user_id=? AND (renews_at>? OR status NOT IN ('canceled','unpaid','incomplete_expired','refunded'))").bind(input.userId,now.toISOString()).first())throw Error('You already have a subscription. Manage it in Billing.');
  amount=input.choice==='annual'?pricing.candidate.premiumAnnual:pricing.candidate.premiumMonthly;
 }else if(input.kind==='verification'){
  if(!input.flags.PRODUCT_PROFILES_V2)throw Error('Verification is unavailable.');if(await db.prepare("SELECT id FROM candidate_verification_requests WHERE user_id=? AND status NOT IN ('refunded','rejected')").bind(input.userId).first())throw Error('You already have a verification request.');amount=pricing.candidate.verifiedBadge;
 }else if(input.kind==='invite_pack'){
  companyId=String(input.payload.companyId??'');if(!input.flags.PRODUCT_TALENT_SEARCH||!await canManageCompany(db,input.tenantId,input.userId,companyId)||(await companyPlan(db,companyId,now))?.tier!=='platinum')throw Error('Only a Platinum company owner can buy extra invitations.');amount=pricing.talentExtraPack.price;
 }else if(input.kind==='extension'){
  const job=await db.prepare("SELECT j.id,j.company_id,j.slug FROM jobs j JOIN employer_listings l ON l.job_id=j.id JOIN employer_orders o ON o.id=l.order_id WHERE j.id=? AND j.tenant_id=? AND l.user_id=? AND j.listed=1 AND l.closed_at IS NULL AND o.status='paid' AND j.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND j.commercial_origin IN ('native','native_ats')").bind(input.payload.jobId,input.tenantId,input.userId).first<{id:string;company_id:string;slug:string}>();if(!job)throw Error('Only an active paid job can be extended. Repost a closed or expired job.');companyId=job.company_id;const plan=await companyPlan(db,companyId,now);amount=plan?pricing.plans[plan.tier].extraPost:pricing.jobPost.base;payload={...payload,jobId:job.id};
 }else throw Error('Unknown purchase.');
 await db.prepare('INSERT OR IGNORE INTO product_orders(id,tenant_id,user_id,company_id,kind,choice,payload_json,total_cents,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(input.id,input.tenantId,input.userId,companyId,input.kind,input.choice,JSON.stringify(payload),amount,now.toISOString()).run();
 const result=await productOrder(db,input.id);if(!result)throw Error('Another checkout for this plan is pending. Resume it from Billing.');return result;
}
const statusPath=(order:ProductOrder)=>order.kind==='company_plan'||order.kind==='invite_pack'||order.kind==='extension'?'/employer/billing':'/account/billing';
export async function startProductCheckout(env:PlatformEnv,order:ProductOrder,email:string){
 if(env.STRIPE_ENABLED!=='true'||!env.STRIPE_SECRET_KEY)throw Error('Sandbox billing is not configured.');
 const origin=appOrigin(env),returnUrl=origin+statusPath(order)+'?order='+order.id;
 if(order.status==='paid')return returnUrl;if(order.status!=='pending')throw Error('This checkout ended. Start a new purchase.');
 if(order.stripe_session_id){const session=await stripeProductRequest(env.STRIPE_SECRET_KEY,'checkout/sessions/'+encodeURIComponent(order.stripe_session_id));if(session.metadata?.productOrderId!==order.id)throw Error('Checkout mismatch.');if(session.status==='complete')return returnUrl;if(session.status==='expired'){await env.DB.prepare("UPDATE product_orders SET status='expired' WHERE id=? AND status='pending'").bind(order.id).run();throw Error('This checkout expired. Start a new purchase.');}if(typeof session.url==='string'&&session.url.startsWith('https://checkout.stripe.com/'))return session.url;throw Error('Checkout unavailable.');}
 const recurring=order.kind==='company_plan'||order.kind==='candidate_premium',interval=order.kind==='company_plan'||order.choice==='annual'?'year':'month';
 const names={company_plan:`Nodework ${order.choice} annual company plan`,candidate_premium:`Nodework Premium (${order.choice})`,verification:'Nodework identity verification review',invite_pack:`Nodework ${pricing.talentExtraPack.invites} extra invitations`,extension:'Extend a Nodework job by 30 days'};
 const body=new URLSearchParams({mode:recurring?'subscription':'payment',customer_email:email,success_url:returnUrl,cancel_url:origin+statusPath(order)+'?cancelled=1','metadata[productOrderId]':order.id,'line_items[0][quantity]':'1','line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(order.total_cents),'line_items[0][price_data][product_data][name]':names[order.kind],billing_address_collection:'required',allow_promotion_codes:'true'});
 body.set(recurring?'subscription_data[metadata][productOrderId]':'payment_intent_data[metadata][productOrderId]',order.id);if(recurring)body.set('line_items[0][price_data][recurring][interval]',interval);
 const session=await stripeProductRequest(env.STRIPE_SECRET_KEY,'checkout/sessions',body,'product:'+order.id);if(session.livemode!==false||!session.id?.startsWith('cs_test_')||!session.url?.startsWith('https://checkout.stripe.com/'))throw Error('Invalid sandbox checkout.');
 await env.DB.prepare('UPDATE product_orders SET stripe_session_id=? WHERE id=? AND stripe_session_id IS NULL').bind(session.id,order.id).run();return session.url as string;
}
function validCheckout(order:ProductOrder,session:StripeObject){
 if(session.id!==order.stripe_session_id||session.metadata?.productOrderId!==order.id||session.livemode!==false||session.currency!==order.currency||session.amount_subtotal!==order.total_cents)throw Error('Product checkout identity or amount mismatch.');
 const discount=session.total_details?.amount_discount??0,tax=session.total_details?.amount_tax??0;
 if(!Number.isSafeInteger(discount)||discount<0||discount>order.total_cents||!Number.isSafeInteger(tax)||tax<0||session.amount_total!==order.total_cents-discount+tax)throw Error('Product checkout total mismatch.');
}
export async function fulfillProductPayment(db:Database,order:ProductOrder,session:StripeObject,eventId:string,now=new Date()){
 if(order.status!=='pending'||!order.user_id||!['paid','no_payment_required'].includes(session.payment_status))return false;validCheckout(order,session);
 if(session.subscription)throw Error('Expected a one-time payment.');const intent=objectId(session.payment_intent),at=now.toISOString();if(session.amount_total>0&&!intent)throw Error('Missing payment reference.');
 const guard="EXISTS(SELECT 1 FROM product_orders WHERE id=? AND status='pending' AND user_id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM payment_reversals WHERE payment_intent_id=?)",values=[order.id,intent],statements:Statement[]=[],payload=JSON.parse(order.payload_json);
 if(order.kind==='verification')statements.push(db.prepare(`INSERT OR IGNORE INTO candidate_verification_requests(id,user_id,order_id,created_at) SELECT ?,?,?,? WHERE ${guard}`).bind('verification:'+order.id,order.user_id,order.id,at,...values));
 else if(order.kind==='invite_pack')statements.push(db.prepare(`INSERT OR IGNORE INTO talent_invite_packs(id,company_id,quantity,created_at) SELECT ?,?,?,? WHERE ${guard}`).bind(order.id,order.company_id,pricing.talentExtraPack.invites,at,...values));
 else if(order.kind==='extension'){
  statements.push(db.prepare(`INSERT OR IGNORE INTO job_extensions(order_id,job_id,base_expiry,created_at) SELECT ?,job_id,COALESCE((SELECT base_expiry FROM job_extensions WHERE job_id=l.job_id ORDER BY created_at,order_id LIMIT 1),l.expires_at),? FROM employer_listings l WHERE l.job_id=? AND l.user_id=? AND ${guard}`).bind(order.id,at,payload.jobId,order.user_id,...values));
  statements.push(...extensionPeriodStatements(db,payload.jobId));
 }else throw Error('Unexpected product payment kind.');
 statements.push(db.prepare(`UPDATE product_orders SET status=CASE WHEN EXISTS(SELECT 1 FROM payment_reversals WHERE payment_intent_id=?) THEN 'refunded' ELSE 'paid' END,stripe_payment_intent_id=?,stripe_customer_id=?,paid_at=? WHERE id=? AND status='pending'`).bind(intent,intent,objectId(session.customer),at,order.id));
 statements.push(db.prepare('INSERT OR IGNORE INTO product_billing_events VALUES(?,?,?,?)').bind(eventId,order.id,'product.paid',at));await db.batch(statements);return true;
}
async function invoicePayment(secret:string,invoice:StripeObject){if(invoice.amount_paid===0)return null;const direct=objectId(invoice.payment_intent);if(direct)return direct;const result=await stripeProductRequest(secret,'invoice_payments?invoice='+encodeURIComponent(invoice.id)+'&status=paid&limit=100');const rows=result.data?.filter((p:any)=>p.payment?.type==='payment_intent');if(result.has_more||rows?.length!==1)throw Error('Invoice payment needs reconciliation.');return objectId(rows[0].payment.payment_intent);}
export async function syncProductSubscription(db:Database,secret:string,subscriptionId:string,now=new Date()){
 const sub=await stripeProductRequest(secret,'subscriptions/'+encodeURIComponent(subscriptionId)),id=sub.metadata?.productOrderId,order=typeof id==='string'?await productOrder(db,id):null;
 if(!order||!order.user_id||!['company_plan','candidate_premium'].includes(order.kind))return false;
 if(sub.livemode!==false||order.stripe_subscription_id&&order.stripe_subscription_id!==sub.id||!order.stripe_session_id)throw Error('Subscription ownership mismatch.');
 const session=await stripeProductRequest(secret,'checkout/sessions/'+encodeURIComponent(order.stripe_session_id));validCheckout(order,session);if(objectId(session.subscription)!==sub.id)throw Error('Subscription checkout mismatch.');
 const item=sub.items?.data?.[0],price=item?.price,interval=order.kind==='company_plan'||order.choice==='annual'?'year':'month';
 if(sub.items?.data?.length!==1||item.quantity!==1||price?.currency!=='usd'||price.unit_amount!==order.total_cents||price.recurring?.interval!==interval||(price.recurring.interval_count??1)!==1)throw Error('Subscription price mismatch.');
 const at=now.toISOString(),customer=objectId(sub.customer),invoiceId=objectId(sub.latest_invoice);if(!invoiceId)return true;
 const invoice=await stripeProductRequest(secret,'invoices/'+encodeURIComponent(invoiceId));if(objectId(invoice.customer)!==customer||(objectId(invoice.subscription)||objectId(invoice.parent?.subscription_details?.subscription))!==sub.id)throw Error('Invoice subscription ownership mismatch.');const line=invoice.lines?.data?.find((l:any)=>l.type==='subscription'||l.parent?.type==='subscription_item_details');
 const start=new Date((line?.period?.start??item.current_period_start??sub.current_period_start)*1000),end=new Date((line?.period?.end??item.current_period_end??sub.current_period_end)*1000);
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)throw Error('Invalid subscription period.');
 const paid=invoice.status==='paid'&&invoice.currency==='usd'&&invoice.subtotal===order.total_cents;
 const intent=paid?await invoicePayment(secret,invoice):null;if(paid&&invoice.amount_paid>0&&!intent)throw Error('Invoice payment missing.');
 const reversed=!!(intent&&await db.prepare('SELECT payment_intent_id FROM payment_reversals WHERE payment_intent_id=?').bind(intent).first());
 const status=reversed?'refunded':sub.status==='active'&&paid?'active':String(sub.status==='active'?'past_due':sub.status),enabled=paid&&!reversed&&['active','trialing'].includes(status);
 const statements:Statement[]=[db.prepare('UPDATE product_orders SET stripe_subscription_id=?,stripe_customer_id=?,status=CASE WHEN ?=1 THEN ? ELSE status END,paid_at=CASE WHEN ?=1 THEN COALESCE(paid_at,?) ELSE paid_at END WHERE id=?').bind(sub.id,customer,paid?1:0,reversed?'refunded':'paid',paid?1:0,at,order.id)];
 if(paid)statements.push(db.prepare('INSERT OR IGNORE INTO product_subscription_invoices(id,order_id,provider_ref,payment_intent_id,period_start,period_end,amount_paid,hosted_url,revoked) VALUES(?,?,?,?,?,?,?,?,?)').bind(invoice.id,order.id,sub.id,intent,start.toISOString(),end.toISOString(),invoice.amount_paid,invoice.hosted_invoice_url??null,reversed?1:0));
 if(order.kind==='candidate_premium')statements.push(db.prepare(`INSERT INTO candidate_subscriptions(user_id,plan,status,provider_ref,customer_id,renews_at,cancel_at_period_end,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,provider_ref=excluded.provider_ref,customer_id=excluded.customer_id,renews_at=excluded.renews_at,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=excluded.updated_at WHERE candidate_subscriptions.provider_ref=excluded.provider_ref OR COALESCE((SELECT created_at FROM product_orders WHERE stripe_subscription_id=excluded.provider_ref),'')>=COALESCE((SELECT created_at FROM product_orders WHERE stripe_subscription_id=candidate_subscriptions.provider_ref),'')`).bind(order.user_id,order.choice,status,sub.id,customer,end.toISOString(),sub.cancel_at_period_end?1:0,at));
 else{
  statements.push(db.prepare(`INSERT INTO company_plans(company_id,owner_user_id,tier,provider_ref,customer_id,status,period_start,renews_at,cancel_at_period_end,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET owner_user_id=excluded.owner_user_id,tier=excluded.tier,provider_ref=excluded.provider_ref,customer_id=excluded.customer_id,status=excluded.status,period_start=excluded.period_start,renews_at=excluded.renews_at,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=excluded.updated_at WHERE company_plans.provider_ref=excluded.provider_ref OR COALESCE((SELECT created_at FROM product_orders WHERE stripe_subscription_id=excluded.provider_ref),'')>=COALESCE((SELECT created_at FROM product_orders WHERE stripe_subscription_id=company_plans.provider_ref),'')`).bind(order.company_id,order.user_id,order.choice,sub.id,customer,status,start.toISOString(),end.toISOString(),sub.cancel_at_period_end?1:0,at));
  if(enabled){const company=JSON.parse(order.payload_json).company;statements.push(db.prepare('INSERT OR IGNORE INTO company_plan_periods(id,company_id,provider_ref,tier,granted,period_start,expires_at,payment_intent_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(invoice.id,order.company_id,sub.id,order.choice,pricing.plans[order.choice as CompanyPlanTier].posts??0,start.toISOString(),end.toISOString(),intent,at));
   statements.push(...companyPurchaseStatements(db,{id:'purchase:plan:'+invoice.id,tenantId:order.tenant_id,userId:order.user_id,companyId:order.company_id!,companyUrl:company.url,kind:'annual_plan',sourceId:invoice.id,paymentIntent:intent},now,'NOT EXISTS(SELECT 1 FROM payment_reversals WHERE payment_intent_id=?)',[intent]));
   statements.push(db.prepare('UPDATE companies SET listed=1,pending_publication=0 WHERE id=? AND pending_publication=1').bind(order.company_id));
  }
 }
 if(paid)statements.push(db.prepare(`INSERT OR IGNORE INTO notification_outbox(id,user_id,kind,subject,body,destination_path,created_at) VALUES(?,?,'plan_renewal','Your Nodework plan payment was received','Review your subscription period and invoice in Billing.',?,?)`).bind('invoice:'+invoice.id,order.user_id,statusPath(order),at));
 await db.batch(statements);if(intent&&await db.prepare('SELECT payment_intent_id FROM payment_reversals WHERE payment_intent_id=?').bind(intent).first())await reverseProductPayment(db,intent,now);return true;
}
export async function reconcileProductOrder(env:PlatformEnv,order:ProductOrder){if(!env.STRIPE_SECRET_KEY||!order.stripe_session_id)throw Error('No checkout to reconcile.');const session=await stripeProductRequest(env.STRIPE_SECRET_KEY,'checkout/sessions/'+encodeURIComponent(order.stripe_session_id));validCheckout(order,session);if(session.subscription)return syncProductSubscription(env.DB,env.STRIPE_SECRET_KEY,objectId(session.subscription)!);if(session.status==='expired'){await env.DB.prepare("UPDATE product_orders SET status='expired' WHERE id=? AND status='pending'").bind(order.id).run();return false;}return fulfillProductPayment(env.DB,order,session,'reconcile:'+session.id);}
export async function handleProductStripeEvent(db:Database,secret:string|undefined,event:{id?:string;type?:string;data?:{object?:unknown}}){
 const object=event.data?.object as StripeObject|undefined;if(!object||!event.type)return false;
 if(object.metadata?.productOrderId&&event.type.startsWith('checkout.session.')){
  const order=await productOrder(db,object.metadata.productOrderId);if(!order)return true;
  if(event.type==='checkout.session.expired'){if(order.stripe_session_id===object.id)await db.prepare("UPDATE product_orders SET status='expired' WHERE id=? AND status='pending'").bind(order.id).run();return true;}
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){if(object.subscription){if(!secret)throw Error('Stripe lookup unavailable');await syncProductSubscription(db,secret,objectId(object.subscription)!);}else await fulfillProductPayment(db,order,object,event.id??'checkout:'+object.id);return true;}
 }
 const subscription=event.type.startsWith('customer.subscription.')?object.id:objectId(object.subscription)||objectId(object.parent?.subscription_details?.subscription);
 if(subscription&&['invoice.paid','invoice.payment_failed','customer.subscription.updated','customer.subscription.deleted','customer.subscription.created'].includes(event.type)){if(!secret)throw Error('Stripe lookup unavailable');return syncProductSubscription(db,secret,subscription);}
 return false;
}

/** Recompute extension time from the remaining purchases, including out-of-order refunds. */
export function extensionPeriodStatements(db:Database,jobId:string):Statement[]{const expiry=`(WITH RECURSIVE purchases AS(SELECT created_at,days,ROW_NUMBER() OVER(ORDER BY created_at,order_id) seq FROM job_extensions WHERE job_id=? AND revoked=0),timeline(seq,expiry) AS(SELECT 0,julianday((SELECT base_expiry FROM job_extensions WHERE job_id=? ORDER BY created_at,order_id LIMIT 1)) UNION ALL SELECT p.seq,MAX(t.expiry,julianday(p.created_at))+p.days FROM timeline t JOIN purchases p ON p.seq=t.seq+1) SELECT strftime('%Y-%m-%dT%H:%M:%fZ',expiry) FROM timeline ORDER BY seq DESC LIMIT 1)`;return [db.prepare(`UPDATE employer_listings SET expires_at=${expiry} WHERE job_id=? AND EXISTS(SELECT 1 FROM job_extensions WHERE job_id=?)`).bind(jobId,jobId,jobId,jobId),db.prepare(`UPDATE jobs SET expires_at=(SELECT expires_at FROM employer_listings WHERE job_id=jobs.id),listed=CASE WHEN (SELECT expires_at FROM employer_listings WHERE job_id=jobs.id)>? AND (SELECT closed_at FROM employer_listings WHERE job_id=jobs.id) IS NULL AND EXISTS(SELECT 1 FROM employer_listings l JOIN employer_orders o ON o.id=l.order_id WHERE l.job_id=jobs.id AND o.status='paid') THEN 1 ELSE 0 END WHERE id=?`).bind(new Date().toISOString(),jobId)];}
export async function reverseProductPayment(db:Database,paymentIntent:string,now=new Date()){
 const at=now.toISOString();const extensions=await db.prepare("SELECT json_extract(payload_json,'$.jobId') job_id FROM product_orders WHERE stripe_payment_intent_id=? AND kind='extension'").bind(paymentIntent).all<{job_id:string}>();
 await db.batch([
 db.prepare("UPDATE product_orders SET status='refunded' WHERE stripe_payment_intent_id=?").bind(paymentIntent),
 db.prepare('UPDATE product_subscription_invoices SET revoked=1 WHERE payment_intent_id=?').bind(paymentIntent),
 db.prepare('UPDATE company_plan_periods SET revoked=1 WHERE payment_intent_id=?').bind(paymentIntent),
 db.prepare("UPDATE candidate_subscriptions SET status='refunded',updated_at=? WHERE EXISTS(SELECT 1 FROM product_subscription_invoices i WHERE i.provider_ref=candidate_subscriptions.provider_ref AND i.period_end=candidate_subscriptions.renews_at AND i.payment_intent_id=?)").bind(at,paymentIntent),
 db.prepare("UPDATE company_plans SET status='refunded',updated_at=? WHERE EXISTS(SELECT 1 FROM company_plan_periods p WHERE p.provider_ref=company_plans.provider_ref AND p.period_start=company_plans.period_start AND p.payment_intent_id=?)").bind(at,paymentIntent),
 db.prepare("UPDATE plan_credit_reservations SET status='released' WHERE status='held' AND period_id IN(SELECT id FROM company_plan_periods WHERE payment_intent_id=?)").bind(paymentIntent),
 db.prepare("UPDATE jobs SET listed=0 WHERE plan_credit_id IN(SELECT id FROM company_plan_periods WHERE payment_intent_id=?) AND id IN(SELECT l.job_id FROM employer_listings l JOIN employer_orders o ON o.id=l.order_id WHERE o.total_cents=0)").bind(paymentIntent),
 db.prepare("UPDATE candidate_verification_requests SET status='refunded' WHERE order_id IN(SELECT id FROM product_orders WHERE stripe_payment_intent_id=?)").bind(paymentIntent),
 db.prepare("UPDATE profiles SET verified_at=NULL WHERE user_id IN(SELECT user_id FROM candidate_verification_requests WHERE order_id IN(SELECT id FROM product_orders WHERE stripe_payment_intent_id=?)) AND NOT EXISTS(SELECT 1 FROM candidate_verification_requests v WHERE v.user_id=profiles.user_id AND v.status='approved')").bind(paymentIntent),
 db.prepare('UPDATE talent_invite_packs SET revoked=1 WHERE id IN(SELECT id FROM product_orders WHERE stripe_payment_intent_id=?)').bind(paymentIntent),
 db.prepare('UPDATE job_extensions SET revoked=1 WHERE order_id IN(SELECT id FROM product_orders WHERE stripe_payment_intent_id=?)').bind(paymentIntent),
 ]);
 for(const e of extensions.results)await db.batch(extensionPeriodStatements(db,e.job_id));
}
