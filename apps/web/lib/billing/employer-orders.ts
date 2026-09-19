import { listingPeriodStatements, slugTitle, normalizeCompanyName } from '@gaming/shared';
import type { Database, Statement } from '../platform';
import type { ListingInput } from './listing-input';
import { quoteListing, type ListingSelection } from './listing-catalog';

export type EmployerOrder={id:string;tenant_id:string;user_id:string;kind:'job'|'bundle';payload_json:string;
  selection_json:string;total_cents:number;currency:string;status:string;stripe_session_id:string|null;
  stripe_subscription_id:string|null;stripe_customer_id:string|null;created_at:string;paid_at:string|null};
export async function orderById(db:Database,id:string) {
  return db.prepare('SELECT * FROM employer_orders WHERE id=?').bind(id).first<EmployerOrder>();
}
export async function createEmployerOrder(db:Database,input:{id:string;tenantId:string;userId:string;
  kind:'job'|'bundle';listing:ListingInput|null;selection:ListingSelection}) {
  const payload=JSON.stringify(input.listing),selection=JSON.stringify(input.selection);
  await db.prepare(`INSERT OR IGNORE INTO employer_orders
    (id,tenant_id,user_id,kind,payload_json,selection_json,total_cents,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(input.id,input.tenantId,input.userId,input.kind,payload,selection,quoteListing(input.selection).totalCents,new Date().toISOString()).run();
  const order=await orderById(db,input.id);
  if(!order||order.user_id!==input.userId||order.tenant_id!==input.tenantId||order.kind!==input.kind
    ||order.payload_json!==payload||order.selection_json!==selection)throw new Error('Submission ID already used; start a new order');
  return order;
}
const addDays=(now:Date,days:number)=>new Date(now.getTime()+days*86400000).toISOString();

/** Every write for fulfilment belongs to one D1 batch transaction. IDs are deterministic. */
function listingStatements(db:Database,order:EmployerOrder,jobId:string,input:ListingInput,options:ListingSelection,
  now:Date,guard='1',guardValues:unknown[]=[]):Statement[] {
  const at=now.toISOString();
  const companySlug=slugTitle(input.companyName);
  const companyNorm=normalizeCompanyName(input.companyName);
  const companyId=`employer:${order.tenant_id}:${companySlug}`;
  const slug=`${slugTitle(input.title)}-${companySlug}-${jobId.replace(/[^a-z0-9]/gi,'').slice(-12)}`;
  const companyWhere='SELECT id FROM companies WHERE tenant_id=? AND name_norm=?';
  const statements=[
    db.prepare(`INSERT OR IGNORE INTO companies(id,tenant_id,name,name_norm,domain,created_at)
      SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(companyId,order.tenant_id,input.companyName,companyNorm,new URL(input.companyUrl).hostname,at,...guardValues),
    db.prepare(`INSERT OR IGNORE INTO jobs(id,tenant_id,company_id,canonical_key,title,title_norm,slug,location,remote,
      description_html,apply_url,salary_min,salary_max,source,featured_until,highlight,posted_at,created_at,updated_at,
      listing_logo_url,highlight_color,expires_at)
      SELECT ?,?,(${companyWhere}),?,?,?,?,?,?,?,?,?,?,'manual',?,?,?,?,?,?,?,? WHERE ${guard}`)
      .bind(jobId,order.tenant_id,order.tenant_id,companyNorm,`paid:${jobId}`,input.title,input.title.toLowerCase(),slug,
        input.location,input.remote,input.descriptionHtml,input.applyUrl||`/jobs/${slug}/apply`,input.salaryMin,input.salaryMax,
        options.stickyDays?addDays(now,options.stickyDays):null,options.highlight==='none'?0:1,at,at,at,
        options.logo?input.logoUrl:null,options.highlight==='custom'?options.color:options.highlight==='standard'?'#830846':null,addDays(now,30),...guardValues),
    db.prepare(`INSERT OR IGNORE INTO employer_listings(job_id,order_id,user_id,apply_mode,contact_email,
      highlight_color,logo_url,support,expires_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM jobs WHERE id=?)`)
      .bind(jobId,order.id,order.user_id,input.applyMode,input.contactEmail,
        options.highlight==='custom'?options.color:options.highlight==='standard'?'#830846':null,
        options.logo?input.logoUrl:null,options.support?1:0,addDays(now,30),jobId),
  ];
  statements.push(db.prepare(`INSERT OR IGNORE INTO listing_details(job_id,input_json,updated_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM jobs WHERE id=?)`)
    .bind(jobId,JSON.stringify(input),at,jobId));
  for(const tag of input.tags){
    statements.push(db.prepare('INSERT OR IGNORE INTO tags(slug,label) VALUES(?,?)').bind(tag,tag.replaceAll('-',' ')));
    statements.push(db.prepare(`INSERT OR IGNORE INTO job_tags(job_id,tag_slug)
      SELECT ?,? WHERE EXISTS(SELECT 1 FROM jobs WHERE id=?)`).bind(jobId,tag,jobId));
  }
  return statements;
}
export type PaidSession={id:string;payment_status:string;status?:string;currency:string;amount_subtotal:number;
  amount_total:number;total_details?:{amount_discount?:number;amount_tax?:number};metadata?:{orderId?:string;purchaseId?:string};
  customer?:string;subscription?:string;payment_intent?:string};
export async function fulfillEmployerOrder(db:Database,session:PaidSession,eventId:string,now=new Date()) {
  if(!['paid','no_payment_required'].includes(session.payment_status))return false;
  const order=await orderById(db,session.metadata?.orderId||'');
  if(!order||order.status!=='pending')return false;
  if(order.stripe_session_id&&order.stripe_session_id!==session.id)throw new Error('Checkout session mismatch');
  const discount=session.total_details?.amount_discount??0,tax=session.total_details?.amount_tax??0;
  if(session.currency!==order.currency||session.amount_subtotal!==order.total_cents||!Number.isSafeInteger(discount)
    ||discount<0||discount>order.total_cents||!Number.isSafeInteger(tax)||tax<0
    ||session.amount_total!==order.total_cents-discount+tax)throw new Error('Checkout amount mismatch');
  const options=JSON.parse(order.selection_json) as ListingSelection;
  const paymentIntent=session.payment_intent??null;
  const guard="EXISTS(SELECT 1 FROM employer_orders WHERE id=? AND status='pending' AND user_id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM payment_reversals WHERE payment_intent_id=?)";
  const guardValues=[order.id,paymentIntent];
  const statements:Statement[]=[];
  if(order.kind==='job')statements.push(...listingStatements(db,order,`paid:${order.id}`,JSON.parse(order.payload_json),options,now,guard,guardValues));
  else {
    const expiry=new Date(now);expiry.setUTCFullYear(expiry.getUTCFullYear()+2);
    for(let slot=0;slot<options.quantity;slot++)statements.push(db.prepare(`INSERT OR IGNORE INTO bundle_credits
      (id,order_id,slot,user_id,selection_json,expires_at) SELECT ?,?,?,?,?,? WHERE ${guard}`)
      .bind(`${order.id}:${slot}`,order.id,slot,order.user_id,order.selection_json,expiry.toISOString(),...guardValues));
  }
  statements.push(db.prepare(`UPDATE employer_orders SET status=CASE WHEN EXISTS(SELECT 1 FROM payment_reversals WHERE payment_intent_id=?) THEN 'refunded' ELSE 'paid' END,paid_at=?,stripe_session_id=?,
    stripe_customer_id=?,stripe_subscription_id=?,stripe_payment_intent_id=? WHERE id=? AND status='pending'`)
    .bind(paymentIntent,now.toISOString(),session.id,session.customer||null,session.subscription||null,paymentIntent,order.id));
  statements.push(db.prepare(`INSERT OR IGNORE INTO billing_events(id,order_id,type,processed_at) VALUES(?,?,'checkout.paid',?)`)
    .bind(eventId,order.id,now.toISOString()));
  statements.push(...listingPeriodStatements(db,now));
  await db.batch(statements);
  return (await orderById(db,order.id))?.status==='paid';
}
export async function redeemCredit(db:Database,userId:string,creditId:string,input:ListingInput,now=new Date()) {
  const credit=await db.prepare(`SELECT c.*,o.tenant_id FROM bundle_credits c JOIN employer_orders o ON o.id=c.order_id
    WHERE c.id=? AND c.user_id=? AND o.status='paid'`).bind(creditId,userId)
    .first<{id:string;order_id:string;tenant_id:string;selection_json:string;job_id:string|null;expires_at:string}>();
  if(!credit||credit.job_id||credit.expires_at<=now.toISOString())throw new Error('Credit unavailable or expired');
  const order=await orderById(db,credit.order_id);
  if(!order)throw new Error('Order missing');
  const selection=JSON.parse(credit.selection_json) as ListingSelection;
  if(selection.logo&&!input.logoUrl)throw new Error('Upload the logo included in this credit');
  const jobId=`credit:${crypto.randomUUID()}`;
  const guard=`EXISTS(SELECT 1 FROM bundle_credits c JOIN employer_orders o ON o.id=c.order_id WHERE c.id=? AND c.user_id=? AND c.job_id IS NULL AND c.expires_at>? AND o.status='paid')`;
  const statements=listingStatements(db,order,jobId,input,JSON.parse(credit.selection_json),now,guard,[credit.id,userId,now.toISOString()]);
  statements.push(db.prepare(`UPDATE bundle_credits SET job_id=? WHERE id=? AND job_id IS NULL
    AND EXISTS(SELECT 1 FROM jobs WHERE id=?)`).bind(jobId,credit.id,jobId));
  await db.batch(statements);
  const redeemed=await db.prepare('SELECT job_id FROM bundle_credits WHERE id=?').bind(credit.id).first<string>('job_id');
  if(redeemed!==jobId)throw new Error('Credit was already used');
  return jobId;
}
/** Use the billed service period, never webhook arrival time. Older invoices cannot shorten a listing. */
export async function renewEmployerListing(db:Database,subscriptionId:string,eventId:string,start:Date,end=new Date(start.getTime()+30*86400000)) {
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)throw new Error('Invalid invoice service period');
  const order=await db.prepare(`SELECT * FROM employer_orders WHERE stripe_subscription_id=? AND status='paid'`).bind(subscriptionId).first<EmployerOrder>();
  if(!order)return false;
  const selection=JSON.parse(order.selection_json) as ListingSelection;
  const guard='NOT EXISTS(SELECT 1 FROM billing_events WHERE id=?)';
  await db.batch([
    db.prepare(`UPDATE jobs SET listed=1,posted_at=?,updated_at=?,featured_until=?,expires_at=? WHERE id IN
      (SELECT job_id FROM employer_listings WHERE order_id=? AND closed_at IS NULL AND expires_at<?) AND ${guard}`)
      .bind(start.toISOString(),new Date().toISOString(),selection.stickyDays?addDays(start,selection.stickyDays):null,end.toISOString(),order.id,end.toISOString(),eventId),
    db.prepare(`UPDATE employer_listings SET expires_at=? WHERE order_id=? AND closed_at IS NULL AND expires_at<? AND ${guard}`).bind(end.toISOString(),order.id,end.toISOString(),eventId),
    db.prepare(`INSERT OR IGNORE INTO billing_events(id,order_id,type,processed_at) VALUES(?,?,'invoice.paid',?)`).bind(eventId,order.id,new Date().toISOString()),
  ]);
  return true;
}
