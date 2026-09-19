type Statement={bind(...args:unknown[]):Statement;first<T=Record<string,unknown>>(column?:string):Promise<T|null>;all<T=Record<string,unknown>>():Promise<{results:T[]}>;run():Promise<{meta?:{changes?:number}}>};
type Database={prepare(sql:string):Statement;batch(statements:Statement[]):Promise<unknown[]>};
/** Only a paid, unrefunded period covering now can publish a recurring listing.
 * The SQL is evaluated inside the caller's D1 transaction, including on Checkout. */
export function listingPeriodStatements(db:Database,now=new Date()){
 const at=now.toISOString();
 const valid=`SELECT i.period_end FROM listing_invoice_periods i WHERE i.order_id=l.order_id AND i.period_start<=? AND i.period_end>?
 AND NOT EXISTS(SELECT 1 FROM payment_reversals r WHERE r.payment_intent_id=i.payment_intent_id) ORDER BY i.period_end DESC LIMIT 1`;
 const live=`SELECT l.job_id FROM employer_listings l JOIN employer_orders o ON o.id=l.order_id WHERE l.closed_at IS NULL AND o.status='paid' AND o.user_id IS NOT NULL AND EXISTS(${valid})`;
 return [
 db.prepare(`UPDATE jobs SET listed=CASE WHEN id IN(${live}) THEN 1 ELSE 0 END,updated_at=? WHERE id IN(SELECT l.job_id FROM employer_listings l WHERE EXISTS(SELECT 1 FROM listing_invoice_periods i WHERE i.order_id=l.order_id))`).bind(at,at,at),
 db.prepare(`UPDATE employer_listings AS l SET expires_at=COALESCE((${valid}),expires_at) WHERE closed_at IS NULL AND EXISTS(SELECT 1 FROM listing_invoice_periods i WHERE i.order_id=l.order_id)`).bind(at,at),
 db.prepare(`UPDATE jobs SET expires_at=(SELECT l.expires_at FROM employer_listings l WHERE l.job_id=jobs.id),
 posted_at=(SELECT MAX(i.period_start) FROM listing_invoice_periods i JOIN employer_listings l ON l.order_id=i.order_id WHERE l.job_id=jobs.id AND i.period_start<=? AND i.period_end>? AND NOT EXISTS(SELECT 1 FROM payment_reversals r WHERE r.payment_intent_id=i.payment_intent_id)),
 featured_until=(SELECT CASE WHEN COALESCE(json_extract(o.selection_json,'$.stickyDays'),0)>0 THEN strftime('%Y-%m-%dT%H:%M:%fZ',MAX(i.period_start),'+'||json_extract(o.selection_json,'$.stickyDays')||' days') ELSE NULL END FROM listing_invoice_periods i JOIN employer_listings l ON l.order_id=i.order_id JOIN employer_orders o ON o.id=i.order_id WHERE l.job_id=jobs.id AND i.period_start<=? AND i.period_end>? AND NOT EXISTS(SELECT 1 FROM payment_reversals r WHERE r.payment_intent_id=i.payment_intent_id))
 WHERE listed=1 AND id IN(SELECT l.job_id FROM employer_listings l WHERE EXISTS(SELECT 1 FROM listing_invoice_periods i WHERE i.order_id=l.order_id))`).bind(at,at,at,at),
 ];
}
export async function reconcileListingPeriods(db:Database,now=new Date()){await db.batch(listingPeriodStatements(db,now));}
