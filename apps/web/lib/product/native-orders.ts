import {normalizeCompanyName,parseJobAddons,quoteJob,slugTitle,type JobAddons,type ProductFlags} from '@gaming/shared';
import type {Database,Statement} from '../platform';
import type {EmployerOrder,PaidSession} from '../billing/employer-orders';
import {companyPurchaseStatements} from './company-claims';
import {nativeLocation,nativeSalaryText,nativeFacetStatements} from './native-listings';
import {parsePosting,type CanonicalPosting} from './posting-input';

type CompanyIdentity={id:string;name:string;domain:string|null;listed:number;pending_publication:number};
type NativeSelection={addons:JobAddons;quote:ReturnType<typeof quoteJob>};
const defaultContext={plan:null,availableCredits:0,postsPublishedInPeriod:0,activePosts:0,firstPost:false,earlyAccessFreeFirstPost:false} as const;
export async function createNativeOrder(db:Database,input:{id:string;tenantId:string;userId:string;listing:unknown;addons:unknown;flags:ProductFlags},now=new Date()) {
  if(!input.flags.PRODUCT_POSTING_V2)throw new Error('Job posting is not available.');
  const user=await db.prepare('SELECT email_verified FROM users WHERE id=? AND tenant_id=?').bind(input.userId,input.tenantId).first<{email_verified:number}>();
  if(!user?.email_verified)throw new Error('Verify your email before purchasing a job post.');
  const addons=parseJobAddons(input.addons);
  // These offers cannot be sold until the server-side application/visibility phases ship.
  if(addons.earlyAccess||addons.confidential)throw new Error('This listing option is not available yet.');
  if(input.flags.PRODUCT_COMPANY_PLANS)throw new Error('Company plan checkout is not available yet.');
  const listing=await parsePosting(db,input.tenantId,input.listing),quote=quoteJob(addons,defaultContext);
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
  const payload=JSON.stringify(listing),selection=JSON.stringify({addons,quote} satisfies NativeSelection);
  await db.prepare(`INSERT OR IGNORE INTO employer_orders(id,tenant_id,user_id,kind,payload_json,selection_json,total_cents,created_at,offer_version) VALUES(?,?,?,'job',?,?,?,?,2)`)
    .bind(input.id,input.tenantId,input.userId,payload,selection,quote.totalCents,now.toISOString()).run();
  const order=await db.prepare('SELECT * FROM employer_orders WHERE id=?').bind(input.id).first<EmployerOrder>();
  if(!order||order.user_id!==input.userId||order.tenant_id!==input.tenantId||order.offer_version!==2||order.payload_json!==payload||order.selection_json!==selection)throw new Error('Submission ID already used; start a new order.');
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
  const input=JSON.parse(order.payload_json) as CanonicalPosting,{addons,quote}=nativeSelection(order);
  if(addons.earlyAccess||addons.confidential)throw new Error('Unsupported native publication option.');
  const at=now.toISOString(),jobId=`paid:${order.id}`,intent=session.payment_intent??null;
  const slug=`${slugTitle(input.title)}-${slugTitle(input.companyName)}-${order.id.replaceAll('-','').slice(-12)}`;
  const location=await nativeLocation(db,input),salaryText=nativeSalaryText(input,addons.hideSalary);
  const expires=addDays(now,quote.durationDays),pin=quote.pinDays?addDays(now,quote.pinDays):null;
  const guard=`EXISTS(SELECT 1 FROM employer_orders WHERE id=? AND status='pending' AND user_id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM payment_reversals WHERE payment_intent_id=?)`;
  const values=[order.id,intent];
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
  statements.push(...nativeFacetStatements(db,jobId,input,location,exists,[jobId]));
  statements.push(...companyPurchaseStatements(db,{id:`purchase:job:${order.id}`,tenantId:order.tenant_id,userId:order.user_id,companyId:input.companyId!,companyUrl:input.companyUrl,kind:'job',sourceId:order.id,paymentIntent:intent},now,guard,values));
  statements.push(db.prepare(`UPDATE employer_orders SET status=CASE WHEN EXISTS(SELECT 1 FROM payment_reversals WHERE payment_intent_id=?) THEN 'refunded' ELSE 'paid' END,
    paid_at=?,stripe_payment_intent_id=?,stripe_customer_id=? WHERE id=? AND status='pending'`).bind(intent,at,intent,session.customer??null,order.id));
  statements.push(db.prepare(`INSERT OR IGNORE INTO billing_events(id,order_id,type,processed_at) VALUES(?,?,'checkout.paid',?)`).bind(eventId,order.id,at));
  await db.batch(statements);
  return (await db.prepare('SELECT status FROM employer_orders WHERE id=?').bind(order.id).first<{status:string}>())?.status==='paid';
}
