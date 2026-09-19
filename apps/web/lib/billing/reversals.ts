import {reconcileListingPeriods} from '@gaming/shared';
import type {Database} from '../platform';

/** Called after a signed event or authenticated Stripe lookup confirms a full refund. */
export async function reversePayment(db:Database,paymentIntent:string,eventId:string,now=new Date()) {
  // Save the refund first, including when its order is not associated yet.
  // Fulfilment checks this record in the same transaction that publishes access.
  await db.prepare('INSERT OR IGNORE INTO payment_reversals(payment_intent_id,event_id,reversed_at) VALUES(?,?,?)')
    .bind(paymentIntent,eventId,now.toISOString()).run();
  const employer=await db.prepare('SELECT id FROM employer_orders WHERE stripe_payment_intent_id=? AND stripe_subscription_id IS NULL').bind(paymentIntent).first<{id:string}>();
  if(employer) await db.batch([
    db.prepare("UPDATE employer_orders SET status='refunded' WHERE id=? AND status IN('paid','pending')").bind(employer.id),
    db.prepare('UPDATE jobs SET listed=0 WHERE id IN(SELECT job_id FROM employer_listings WHERE order_id=?)').bind(employer.id),
    db.prepare('UPDATE employer_listings SET closed_at=? WHERE order_id=?').bind(now.toISOString(),employer.id),
    db.prepare("INSERT OR IGNORE INTO billing_events(id,order_id,type,processed_at) VALUES(?,?,'payment.reversed',?)").bind(eventId,employer.id,now.toISOString()),
  ]);
  const market=await db.prepare('SELECT id FROM marketplace_orders WHERE stripe_payment_intent_id=?').bind(paymentIntent).first<{id:string}>();
  if(market) await db.batch([
    db.prepare("UPDATE marketplace_orders SET status='refunded' WHERE id=? AND status IN('paid','pending')").bind(market.id),
    db.prepare('UPDATE sponsor_slots SET order_id=NULL WHERE order_id=?').bind(market.id),
    db.prepare("INSERT OR IGNORE INTO marketplace_events(id,order_id,type,created_at) VALUES(?,?,'payment.reversed',?)").bind(eventId,market.id,now.toISOString()),
  ]);
  await reconcileListingPeriods(db,now);
}

/** Cancel remote renewals before erasing the local account that manages them. */
export async function prepareCommerceDeletion(db:Database,userId:string,secret?:string,fetcher=fetch) {
  const orders=await db.prepare('SELECT stripe_subscription_id FROM employer_orders WHERE user_id=? AND stripe_subscription_id IS NOT NULL').bind(userId).all<{stripe_subscription_id:string}>();
  for(const order of orders.results){
    if(!secret)throw new Error('Billing must be connected to cancel your recurring listings before deletion');
    const result=await fetcher(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(order.stripe_subscription_id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${secret}`}});
    if(!result.ok){const body=await result.json() as {error?:{code?:string}};if(body.error?.code!=='resource_missing')throw new Error('Subscription cancellation failed; account retained');}
  }
  await db.batch([
    db.prepare('UPDATE jobs SET listed=0 WHERE id IN(SELECT job_id FROM employer_listings WHERE user_id=?)').bind(userId),
    db.prepare("UPDATE employer_listings SET closed_at=?,contact_email='',logo_url=NULL WHERE user_id=?").bind(new Date().toISOString(),userId),
    db.prepare("UPDATE employer_orders SET payload_json='{}',status=CASE WHEN status='pending' THEN 'cancelled' ELSE status END WHERE user_id=?").bind(userId),
    db.prepare('UPDATE sponsor_slots SET order_id=NULL WHERE order_id IN(SELECT id FROM marketplace_orders WHERE user_id=?)').bind(userId),
    db.prepare("UPDATE marketplace_orders SET payload_json='{}',status='cancelled' WHERE user_id=?").bind(userId),
  ]);
}
