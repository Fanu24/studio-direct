import {reconcileListingPeriods} from '@gaming/shared';
import type {Database} from '../platform';
type Invoice=Record<string,any>;
const objectId=(value:any):string|undefined=>typeof value==='string'?value:typeof value?.id==='string'?value.id:undefined;

export async function stripeRead(secret:string,path:string,fetcher=fetch){
 const result=await fetcher('https://api.stripe.com/v1/'+path,{headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(10000)});
 if(!result.ok)throw new Error('Stripe lookup failed');return result.json();
}
/** Retrieve payment associations when Stripe's newer invoice shape omits payment_intent. */
export async function resolveInvoice(secret:string,invoice:Invoice,fetcher=fetch):Promise<Invoice>{
 let result=invoice;
 if(!invoice.lines?.data)result=await stripeRead(secret,'invoices/'+encodeURIComponent(invoice.id),fetcher);
 const subscription=objectId(result.subscription)||objectId(result.parent?.subscription_details?.subscription);
 if(!subscription)return result;
 let orderId=result.subscription_details?.metadata?.orderId||result.parent?.subscription_details?.metadata?.orderId;
 if(!orderId){const sub=await stripeRead(secret,'subscriptions/'+encodeURIComponent(subscription),fetcher);orderId=sub.metadata?.orderId;}
 if(!orderId)return {...result,subscription};
 let paymentIntent=objectId(result.payment_intent);
 if(!paymentIntent&&result.amount_paid>0){
  const payments=await stripeRead(secret,'invoice_payments?invoice='+encodeURIComponent(result.id)+'&status=paid&limit=100',fetcher);
  const paid=payments.data?.filter((p:any)=>p.payment?.type==='payment_intent');
  if(payments.has_more||paid?.length!==1)throw new Error('Invoice payment association needs reconciliation');
  paymentIntent=objectId(paid[0].payment.payment_intent);if(!paymentIntent)throw new Error('Invoice payment missing');
 }
 return {...result,subscription,payment_intent:paymentIntent,orderId};
}

/** Persist periods even before Checkout arrives. Refund markers can precede either event. */
export async function recordPaidInvoice(db:Database,invoice:Invoice,eventId:string,now=new Date()){
 if(invoice.status!=='paid'&&invoice.paid!==true)return false;
 if(!['subscription_create','subscription_cycle'].includes(invoice.billing_reason))return false;
 const subscription=objectId(invoice.subscription)||objectId(invoice.parent?.subscription_details?.subscription);
 if(!subscription)return false;
 const orderId=invoice.orderId||invoice.subscription_details?.metadata?.orderId||invoice.parent?.subscription_details?.metadata?.orderId;
 const order=await db.prepare('SELECT id,total_cents,currency,stripe_subscription_id,stripe_customer_id,selection_json FROM employer_orders WHERE (id=? OR stripe_subscription_id=?) AND kind=\'job\'').bind(orderId||'',subscription).first<{id:string;total_cents:number;currency:string;stripe_subscription_id:string|null;stripe_customer_id:string|null;selection_json:string}>();
 if(!order)return false;
 if(!JSON.parse(order.selection_json).autoRenew||order.stripe_subscription_id&&order.stripe_subscription_id!==subscription||order.stripe_customer_id&&order.stripe_customer_id!==objectId(invoice.customer))throw new Error('Invoice ownership mismatch');
 const lines=invoice.lines?.data?.filter((line:any)=>line.type==='subscription'||line.parent?.type==='subscription_item_details');
 if(invoice.lines?.has_more||lines?.length!==1)throw new Error('Invoice period missing or ambiguous');
 const line=lines[0],start=new Date(line.period?.start*1000),end=new Date(line.period?.end*1000);
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)throw new Error('Invalid invoice service period');
 if(invoice.currency!==order.currency||invoice.subtotal!==order.total_cents||!Number.isSafeInteger(invoice.amount_paid)||invoice.amount_paid<0)throw new Error('Invoice amount mismatch');
 const payment=objectId(invoice.payment_intent);if(invoice.amount_paid>0&&!payment)throw new Error('Invoice payment missing');
 await db.prepare(`INSERT INTO listing_invoice_periods(invoice_id,order_id,subscription_id,payment_intent_id,period_start,period_end,amount_paid,currency,event_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(invoice_id) DO NOTHING`)
 .bind(invoice.id,order.id,subscription,payment||null,start.toISOString(),end.toISOString(),invoice.amount_paid,invoice.currency,eventId,now.toISOString()).run();
 await reconcileListingPeriods(db,now);return true;
}

export async function recordSubscriptionState(db:Database,subscription:Invoice,created:number){
 if(typeof subscription.id!=='string'||!Number.isSafeInteger(created))return;
 const status=subscription.cancel_at_period_end?'cancelling':String(subscription.status||'unknown');
 const end=subscription.current_period_end??subscription.items?.data?.[0]?.current_period_end;
 const next=Number.isFinite(end)?new Date(end*1000).toISOString():null;
 await db.prepare(`UPDATE employer_orders SET renewal_status=?,renewal_next_at=?,subscription_event_at=? WHERE stripe_subscription_id=? AND subscription_event_at<=?`).bind(status,next,created,subscription.id,created).run();
}
export async function invoiceNotification(db:Database,invoice:Invoice,kind:'renewal_reminder'|'payment_failed'){
 const subscription=objectId(invoice.subscription)||objectId(invoice.parent?.subscription_details?.subscription);if(!subscription)return;
 const period=invoice.period_end||invoice.created||0;
 const id=kind+':'+(invoice.id||subscription+':'+period);
 await db.prepare(`INSERT OR IGNORE INTO notification_outbox(id,user_id,kind,subject,body,destination_path,created_at)
 SELECT ?,user_id,?,?,?,?,? FROM employer_orders WHERE stripe_subscription_id=? AND user_id IS NOT NULL AND status='paid'`)
 .bind(id,kind,kind==='renewal_reminder'?'Your job listing will renew soon':'Your job listing payment failed',kind==='renewal_reminder'?'Your recurring job listing is due to renew. Review the charge or cancel the renewal from Manage billing in your employer dashboard.':'Stripe could not collect your renewal payment. Update your payment method in Manage billing. Your listing expires at the end of its paid period.','/employer',new Date().toISOString(),subscription).run();
}
