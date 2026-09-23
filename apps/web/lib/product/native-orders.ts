import {normalizeCompanyName,parseJobAddons,quoteJob,slugTitle,pricing,type JobAddons,type JobQuoteContext,type ProductFlags} from '@gaming/shared';
import type {Database,Statement} from '../platform';
import type {EmployerOrder,PaidSession} from '../billing/employer-orders';
import {companyPurchaseStatements} from './company-claims';
import {assignNativeRole,nativeLocation,nativeSalaryText,nativeFacetStatements} from './native-listings';
import {parsePosting,type CanonicalPosting} from './posting-input';
import {companyQuoteContext,reserveCompanyPost,consumeCompanyPostStatements} from './company-plans';

type CompanyIdentity={id:string;name:string;domain:string|null;listed:number;pending_publication:number};
type NativeSelection={addons:JobAddons;quote:ReturnType<typeof quoteJob>;context?:JobQuoteContext;periodId?:string|null};
const defaultContext={plan:null,availableCredits:0,postsPublishedInPeriod:0,activePosts:0,firstPost:false,earlyAccessFreeFirstPost:false} as const;
export async function createNativeOrder(db:Database,input:{id:string;tenantId:string;userId:string;listing:unknown;addons:unknown;flags:ProductFlags},now=new Date()) {
  if(!input.flags.PRODUCT_POSTING_V2)throw new Error('Job posting is not available.');
  const user=await db.prepare('SELECT email_verified FROM users WHERE id=? AND tenant_id=?').bind(input.userId,input.tenantId).first<{email_verified:number}>();
  if(!user?.email_verified)throw new Error('Verify your email before purchasing a job post.');
  const addons=parseJobAddons(input.addons);
  // These offers cannot be sold until the server-side application/visibility phases ship.
  if((addons.earlyAccess&&!input.flags.PRODUCT_EARLY_ACCESS)||(addons.confidential&&!input.flags.PRODUCT_CONFIDENTIAL_POSTS))throw new Error('This listing option is not available yet.');
  const listing=await parsePosting(db,input.tenantId,input.listing);
  let company=listing.companyId?await db.prepare('SELECT id,name,domain,listed,pending_publication FROM companies WHERE id=? AND tenant_id=?').bind(listing.companyId,input.tenantId).first<{id:string;name:string;domain:string|null;listed:number;pending_publication:number}>():
    await db.prepare('SELECT id,name,domain,listed,pending_publication FROM companies WHERE tenant_id=? AND (name_norm=? OR domain=? OR domain=?) ORDER BY listed DESC,id LIMIT 1').bind(input.tenantId,normalizeCompanyName(listing.companyName),listing.companyDomain,'www.'+listing.companyDomain).first<{id:string;name:string;domain:string|null;listed:number;pending_publication:number}>();
  if(company&&(!company.listed&&!company.pending_publication||company.domain?.replace(/^www\./,'').toLowerCase()!==listing.companyDomain))throw new Error('Company identity needs review. Contact support before purchasing.');
  if(!company){
    const companyId='draft-company:'+crypto.randomUUID();
    await db.prepare(`INSERT OR IGNORE INTO companies(id,tenant_id,name,name_norm,domain,listed,pending_publication,created_at) VALUES(?,?,?,?,?,0,1,?)`)
      .bind(companyId,input.tenantId,listing.companyName,normalizeCompanyName(listing.companyName),listing.companyDomain,now.toISOString()).run();
    company=await db.prepare('SELECT id,name,domain,listed,pending_publication FROM companies WHERE tenant_id=? AND name_norm=?').bind(input.tenantId,normalizeCompanyName(listing.companyName)).first<CompanyIdentity>();
    if(!company||company.domain?.replace(/^www\./,'').toLowerCase()!==listing.companyDomain||(!company.listed&&!company.pending_publication))throw new Error('Company identity changed. Review the company before purchasing.');
  }
  listing.companyId=company.id;listing.companyName=company.name;
  const payload=JSON.stringify(listing),existing=await db.prepare('SELECT * FROM employer_orders WHERE id=?').bind(input.id).first<EmployerOrder>();
  if(existing){if(existing.user_id!==input.userId||existing.tenant_id!==input.tenantId||existing.offer_version!==2||existing.payload_json!==payload||JSON.stringify(nativeSelection(existing).addons)!==JSON.stringify(addons))throw Error('Submission ID already used; start a new order.');if(existing.status==='pending'){const selected=nativeSelection(existing);if(selected.context?.plan&&selected.periodId)await reserveCompanyPost(db,existing.id,company.id,selected.periodId,selected.context,now);}return existing;}
  const allowance=await companyQuoteContext(db,input.userId,company.id,input.flags.EARLY_ACCESS_FREE_FIRST_POST,now);
  const context=input.flags.PRODUCT_COMPANY_PLANS?allowance.context:{...defaultContext,firstPost:allowance.context.firstPost,earlyAccessFreeFirstPost:input.flags.EARLY_ACCESS_FREE_FIRST_POST};
  const quote=quoteJob(addons,context),selection=JSON.stringify({addons,quote,context,periodId:allowance.periodId} satisfies NativeSelection);
  await db.prepare(`INSERT OR IGNORE INTO employer_orders(id,tenant_id,user_id,kind,payload_json,selection_json,total_cents,created_at,offer_version) VALUES(?,?,?,'job',?,?,?,?,2)`)
    .bind(input.id,input.tenantId,input.userId,payload,selection,quote.totalCents,now.toISOString()).run();
  const order=await db.prepare('SELECT * FROM employer_orders WHERE id=?').bind(input.id).first<EmployerOrder>();
  if(!order||order.user_id!==input.userId||order.tenant_id!==input.tenantId||order.offer_version!==2||order.payload_json!==payload||order.selection_json!==selection)throw new Error('Submission ID already used; start a new order.');
  if(context.plan&&allowance.periodId)try{await reserveCompanyPost(db,order.id,company.id,allowance.periodId,context,now);}catch(error){await db.prepare("UPDATE employer_orders SET status='cancelled' WHERE id=? AND status='pending'").bind(order.id).run();throw error;}
  return order;
}

export function nativeSelection(order:EmployerOrder):NativeSelection {
  if(order.offer_version!==2)throw new Error('Not a product job order.');
  return JSON.parse(order.selection_json) as NativeSelection;
}
const addDays=(now:Date,days:number)=>new Date(now.getTime()+days*86400000).toISOString();
export async function fulfillNativeOrder(db:Database,order:EmployerOrder,session:PaidSession,eventId:string,now=new Date()) {
  if(order.status!=='pending'||!order.user_id||!['paid','no_payment_required'].includes(session.payment_status))return false;
  if(session.livemode===true)throw new Error('Expected a test-mode checkout');
  if(!order.stripe_session_id||order.stripe_session_id!==session.id||session.subscription)throw new Error('Native checkout session mismatch.');
  const discount=session.total_details?.amount_discount??0,tax=session.total_details?.amount_tax??0;
  if(session.currency!==order.currency||session.amount_subtotal!==order.total_cents||!Number.isSafeInteger(discount)||discount<0||discount>order.total_cents||!Number.isSafeInteger(tax)||tax<0||session.amount_total!==order.total_cents-discount+tax)throw new Error('Native checkout amount mismatch.');
  if(session.amount_total>0&&!session.payment_intent)throw new Error('Native payment reference missing.');
  const input=JSON.parse(order.payload_json) as CanonicalPosting,{addons,quote,context}=nativeSelection(order);

  const at=now.toISOString(),jobId=`paid:${order.id}`,intent=session.payment_intent??null;
  const slug=`${slugTitle(input.title)}-${slugTitle(input.companyName)}-${order.id.replaceAll('-','').slice(-12)}`;
  const location=await nativeLocation(db,input),salaryText=nativeSalaryText(input,addons.hideSalary);
  const expires=addDays(now,quote.durationDays),pin=quote.pinDays?addDays(now,quote.pinDays):null;
  const reservation=context?.plan?await db.prepare("SELECT order_id FROM plan_credit_reservations WHERE order_id=? AND status='held'").bind(order.id).first():true;
  if(!reservation)throw Error('Company post reservation needs reconciliation.');
  const guard=`EXISTS(SELECT 1 FROM employer_orders WHERE id=? AND status='pending' AND user_id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM payment_reversals WHERE payment_intent_id=?)${context?.plan?" AND EXISTS(SELECT 1 FROM plan_credit_reservations WHERE order_id=? AND status='held')":''}`;
  const values=[order.id,intent,...(context?.plan?[order.id]:[])];
  const exists='EXISTS(SELECT 1 FROM jobs WHERE id=?)';
  const statements:Statement[]=[
    db.prepare(`UPDATE companies SET listed=1,pending_publication=0 WHERE id=? AND pending_publication=1 AND ${guard}`).bind(input.companyId,...values),
    db.prepare(`INSERT OR IGNORE INTO jobs(id,tenant_id,company_id,canonical_key,title,title_norm,slug,location,remote,description_html,description_text,apply_url,
      salary_text,salary_min,salary_max,salary_currency,salary_period,hide_salary,crypto_payment_available,source,commercial_origin,
      featured_until,pinned_until,highlight,posted_at,published_at,created_at,updated_at,expires_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'manual','native',?,?,?,?,?,?,?,? WHERE ${guard}`)
      .bind(jobId,order.tenant_id,input.companyId,`paid:${jobId}`,input.title,input.title.toLowerCase(),slug,location,input.workArrangement,input.descriptionHtml,input.descriptionText,
        input.applyMode==='redirect'?input.applyUrl:`/jobs/${slug}/apply`,salaryText,input.salaryMin,input.salaryMax,input.salaryCurrency,input.salaryPeriod,addons.hideSalary?1:0,input.cryptoPaymentAvailable?1:0,
        pin,pin,pin?1:0,at,at,at,at,expires,...values),
    db.prepare(`INSERT OR IGNORE INTO employer_listings(job_id,order_id,user_id,apply_mode,contact_email,expires_at) SELECT ?,?,?,?,?,? WHERE ${exists}`)
      .bind(jobId,order.id,order.user_id,input.applyMode==='email'?'internal':'external',input.applicationsEmail,expires,jobId),
    db.prepare(`INSERT OR IGNORE INTO native_listing_details(job_id,input_json,addons_json,updated_at) SELECT ?,?,?,? WHERE ${exists}`).bind(jobId,order.payload_json,JSON.stringify(addons),at,jobId),
  ];
  statements.push(db.prepare("UPDATE jobs SET commercial_origin='native_ats',source='ats' WHERE id=? AND EXISTS(SELECT 1 FROM company_ats_jobs WHERE order_id=?)").bind(jobId,order.id));
  statements.push(db.prepare("UPDATE company_ats_jobs SET job_id=?,status='published',validation_error=NULL WHERE order_id=? AND EXISTS(SELECT 1 FROM jobs WHERE id=?)").bind(jobId,order.id,jobId));
  statements.push(...nativeFacetStatements(db,jobId,input,location,exists,[jobId]));
  if(addons.confidential)statements.push(db.prepare('UPDATE jobs SET confidential=1 WHERE id=?').bind(jobId));
  if(addons.earlyAccess)statements.push(db.prepare('UPDATE jobs SET early_access_until=? WHERE id=? AND early_access_until IS NULL').bind(new Date(now.getTime()+pricing.addons.earlyAccess.hours*3600000).toISOString(),jobId));
  statements.push(...companyPurchaseStatements(db,{id:`purchase:job:${order.id}`,tenantId:order.tenant_id,userId:order.user_id,companyId:input.companyId!,companyUrl:input.companyUrl,kind:'job',sourceId:order.id,paymentIntent:intent},now,guard,values));
  statements.push(...consumeCompanyPostStatements(db,order.id,jobId,context?.plan??null,now));
  statements.push(db.prepare(`UPDATE employer_orders SET status=CASE WHEN EXISTS(SELECT 1 FROM payment_reversals WHERE payment_intent_id=?) THEN 'refunded' ELSE 'paid' END,
    paid_at=?,stripe_payment_intent_id=?,stripe_customer_id=? WHERE id=? AND status='pending'`).bind(intent,at,intent,session.customer??null,order.id));
  statements.push(db.prepare(`INSERT OR IGNORE INTO billing_events(id,order_id,type,processed_at) VALUES(?,?,'checkout.paid',?)`).bind(eventId,order.id,at));
  await db.batch(statements);
  await assignNativeRole(db,jobId,input.title);
  return (await db.prepare('SELECT status FROM employer_orders WHERE id=?').bind(order.id).first<{status:string}>())?.status==='paid';
}
