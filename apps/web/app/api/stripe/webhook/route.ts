import {resolveInvoice,recordPaidInvoice,stripeRead,recordSubscriptionState,invoiceNotification} from '../../../../lib/billing/invoices';
import {reversePayment} from '../../../../lib/billing/reversals';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { fulfillEmployerOrder, type PaidSession } from '../../../../lib/billing/employer-orders';
import type { Database } from '../../../../lib/platform';
import {fulfillMarketOrder,expireMarketCheckout} from '../../../../lib/billing/marketplace';

import {
  applyStripeEvent,
  verifyStripeWebhook,
  type BillingDatabase,
} from "../../../../lib/billing/plans";

type StripeWebhookEnv = {
  DB: BillingDatabase & Database;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
};

async function webhookEnv(): Promise<StripeWebhookEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as StripeWebhookEnv;
}

export async function POST(request: Request) {
  const env = await webhookEnv();
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ code: "webhook_unconfigured" }, { status: 503 });
  }

  const payload = await request.text();
  const header = request.headers.get("stripe-signature");
  if (!verifyStripeWebhook({ payload, header, secret })) {
    return Response.json({ code: "invalid_signature" }, { status: 400 });
  }

  let event: { id?: string; created?:number; type?: string; data?: { object?: unknown } };
  try {
    event = JSON.parse(payload) as { type?: string; data?: { object?: unknown } };
  } catch {
    return Response.json({ code: "invalid_payload" }, { status: 400 });
  }

  const object = event.data?.object as Record<string, any> | undefined;
  if(event.type==='charge.refunded'&&object?.refunded===true&&typeof object.payment_intent==='string'&&event.id){
    await reversePayment(env.DB,object.payment_intent,event.id);
  } else if (object?.metadata?.purchaseId && ['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type || '')) {
    if(!event.id)return Response.json({code:'invalid_event'},{status:400});
    await fulfillMarketOrder(env.DB,object as PaidSession,event.id);
  } else if(event.type==='checkout.session.expired'&&object?.metadata?.purchaseId&&event.id){
    await expireMarketCheckout(env.DB,object.id,event.id);
  } else if (object?.metadata?.orderId && ['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type || '')) {
    if (!event.id) return Response.json({ code: 'invalid_event' }, { status: 400 });
    if(object.subscription){
      if(!env.STRIPE_SECRET_KEY||!object.invoice)throw new Error('Subscription invoice lookup unavailable');
      const invoice=await stripeRead(env.STRIPE_SECRET_KEY,'invoices/'+encodeURIComponent(typeof object.invoice==='string'?object.invoice:object.invoice.id));
      await recordPaidInvoice(env.DB,await resolveInvoice(env.STRIPE_SECRET_KEY,invoice),event.id);
    }
    await fulfillEmployerOrder(env.DB, object as PaidSession, event.id);
    if(object.subscription&&env.STRIPE_SECRET_KEY){
      const subscription=await stripeRead(env.STRIPE_SECRET_KEY,'subscriptions/'+encodeURIComponent(typeof object.subscription==='string'?object.subscription:object.subscription.id));
      await recordSubscriptionState(env.DB,subscription,Math.floor(Date.now()/1000));
    }
  } else if (event.type === 'invoice.paid' && object && event.id) {
    if(!env.STRIPE_SECRET_KEY)throw new Error('Stripe invoice lookup unavailable');
    const invoice=await resolveInvoice(env.STRIPE_SECRET_KEY,object);
    if(!await recordPaidInvoice(env.DB,invoice,event.id))await applyStripeEvent(env.DB,event);
  } else if(object&&['customer.subscription.updated','customer.subscription.deleted'].includes(event.type||'')){
    await recordSubscriptionState(env.DB,object,event.created||0);
    await applyStripeEvent(env.DB,event);
  } else if(object&&['invoice.upcoming','invoice.payment_failed'].includes(event.type||'')){
    await invoiceNotification(env.DB,object,event.type==='invoice.upcoming'?'renewal_reminder':'payment_failed');
  } else {
    await applyStripeEvent(env.DB, event);
  }
  return Response.json({ received: true });
}
