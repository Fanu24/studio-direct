import type {Database} from '../platform';
import {stripeRead,resolveInvoice,recordPaidInvoice} from './invoices';
import {fulfillEmployerOrder} from './employer-orders';
import {fulfillMarketOrder,expireMarketCheckout} from './marketplace';
import {reversePayment} from './reversals';
/** Bounded operator reconciliation. Stripe remains the payment authority. */
export async function reconcileOrder(db:Database,secret:string,id:string,after='',fetcher=fetch){
 const employer=await db.prepare('SELECT * FROM employer_orders WHERE id=?').bind(id).first<Record<string,any>>();
 const order=employer??await db.prepare('SELECT * FROM marketplace_orders WHERE id=?').bind(id).first<Record<string,any>>();if(!order)throw new Error('Order not found');
 if(!order.stripe_session_id)throw new Error('No recorded checkout session. Sponsor recovery checks orphaned reservations separately.');
 const session=await stripeRead(secret,'checkout/sessions/'+encodeURIComponent(order.stripe_session_id),fetcher);
 if((employer?session.metadata?.orderId:session.metadata?.purchaseId)!==id)throw new Error('Checkout ownership mismatch');
 async function refundCheck(pi:string|undefined){if(!pi)return;const payment=await stripeRead(secret,'payment_intents/'+encodeURIComponent(pi)+'?expand[]=latest_charge',fetcher);if(payment.latest_charge?.refunded)await reversePayment(db,pi,'reconcile:refund:'+pi);}
 if(session.payment_intent)await refundCheck(session.payment_intent);
 let next:string|null=null;
 if(employer&&session.subscription){
  const params=new URLSearchParams({subscription:session.subscription,status:'paid',limit:'10'});if(after)params.set('starting_after',after);
  const invoices=await stripeRead(secret,'invoices?'+params,fetcher);
  for(const item of invoices.data){const invoice=await resolveInvoice(secret,item,fetcher);await refundCheck(invoice.payment_intent);await recordPaidInvoice(db,invoice,'reconcile:'+invoice.id);}
  if(invoices.has_more)next=invoices.data.at(-1)?.id??null;
 }
 if(employer)await fulfillEmployerOrder(db,session,'reconcile:'+session.id);
 else if(session.status==='expired')await expireMarketCheckout(db,session.id,'reconcile:'+session.id);
 else await fulfillMarketOrder(db,session,'reconcile:'+session.id);
 return {next,status:session.status};
}
