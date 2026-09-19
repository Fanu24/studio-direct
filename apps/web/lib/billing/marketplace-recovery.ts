import type {Database} from '../platform';
import type {PaidSession} from './employer-orders';
import {expireMarketCheckout,fulfillMarketOrder} from './marketplace';
import {reversePayment} from './reversals';

type Checkout=PaidSession&{status:'open'|'complete'|'expired'};
type Pending={id:string;stripe_session_id:string|null;created_at:string};

/** Release inventory only after Stripe confirms expiration or a complete lookup
 * proves no session exists. An API failure or truncated lookup keeps the hold. */
export async function recoverMarketCheckouts(db:Database,secret:string,fetcher=fetch,now=new Date()) {
 // Public inventory reads may trigger recovery; bound Stripe traffic across requests.
 await db.prepare("INSERT OR IGNORE INTO marketplace_settings(key,value) VALUES('checkout_recovery_at','1970-01-01')").run();
 const claim=await db.prepare("UPDATE marketplace_settings SET value=? WHERE key='checkout_recovery_at' AND value<?")
  .bind(now.toISOString(),new Date(now.getTime()-120000).toISOString()).run();
 if(!claim.meta?.changes)return {recovered:0,failed:0};
 const pending=await db.prepare(`SELECT o.id,o.stripe_session_id,o.created_at FROM marketplace_orders o
   JOIN sponsor_slots s ON s.order_id=o.id WHERE o.status='pending' AND o.created_at<? ORDER BY o.created_at LIMIT 4`)
   .bind(new Date(now.getTime()-15*60000).toISOString()).all<Pending>();
 let recovered=0,failed=0;
 // Inventory requests must not wait for a separate timeout for every lookup.
 const signal=AbortSignal.timeout(8000);
 let requests=0;
 async function get(path:string){
  signal.throwIfAborted();
  if(++requests>8)throw new Error('Reconciliation request budget exhausted');
  const response=await fetcher('https://api.stripe.com/v1/'+path,{headers:{Authorization:'Bearer '+secret},signal});
  if(!response.ok)throw new Error('Stripe reconciliation unavailable');
  return response.json();
 }
 for(const order of pending.results){
  try{
   let session:Checkout|null=null;
   if(order.stripe_session_id)session=await get('checkout/sessions/'+encodeURIComponent(order.stripe_session_id)) as Checkout;
   else {
    // A process can stop after Stripe creates a session but before D1 saves its ID.
    const params=new URLSearchParams({limit:'100','created[gte]':String(Math.floor(Date.parse(order.created_at)/1000)-60)});
    let complete=false;
    for(let page=0;page<5;page++){
     const list=await get('checkout/sessions?'+params) as {data:Checkout[];has_more:boolean};
     if(!Array.isArray(list.data)||typeof list.has_more!=='boolean')throw new Error('Invalid session list');
     session=list.data.find(s=>s.metadata?.purchaseId===order.id)??null;
     if(session||!list.has_more){complete=true;break;}
     const cursor=list.data.at(-1)?.id;if(!cursor)throw new Error('Missing pagination cursor');params.set('starting_after',cursor);
    }
    if(!complete)throw new Error('Session lookup needs another reconciliation pass');
   }
   if(session){
    if(session.metadata?.purchaseId!==order.id)throw new Error('Checkout ownership mismatch');
    await db.prepare("UPDATE marketplace_orders SET stripe_session_id=? WHERE id=? AND stripe_session_id IS NULL AND status='pending'").bind(session.id,order.id).run();
    if(session.status==='expired'){await expireMarketCheckout(db,session.id,'reconcile:expired:'+session.id);recovered++;}
    else if(session.status==='complete'){
     // Checkout stays `paid` after a refund. Check the charge before recovering access.
     if(!session.payment_intent)throw new Error('Completed checkout has no payment intent');
     const payment=await get('payment_intents/'+encodeURIComponent(session.payment_intent)+'?expand[]=latest_charge') as {status:string;latest_charge?:{refunded?:boolean}};
     if(payment.status!=='succeeded'||!payment.latest_charge||typeof payment.latest_charge!=='object')throw new Error('Payment confirmation unavailable');
     if(payment.latest_charge.refunded)await reversePayment(db,session.payment_intent,'reconcile:refund:'+session.payment_intent,now);
     await fulfillMarketOrder(db,session,'reconcile:paid:'+session.id,now);recovered++;
    }
   }else{
    await db.batch([
     db.prepare("UPDATE marketplace_orders SET status='expired' WHERE id=? AND status='pending' AND stripe_session_id IS NULL").bind(order.id),
     db.prepare("UPDATE sponsor_slots SET order_id=NULL WHERE order_id=? AND EXISTS(SELECT 1 FROM marketplace_orders WHERE id=? AND status='expired')").bind(order.id,order.id),
    ]);recovered++;
   }
  }catch{failed++;}
 }
 return {recovered,failed};
}
