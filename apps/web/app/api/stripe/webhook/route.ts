import {reversePayment} from '../../../../lib/billing/reversals';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { fulfillEmployerOrder, renewEmployerListing, type PaidSession } from '../../../../lib/billing/employer-orders';
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

  let event: { id?: string; type?: string; data?: { object?: unknown } };
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
    await fulfillEmployerOrder(env.DB, object as PaidSession, event.id);
  } else if (event.type === 'invoice.paid' && object?.billing_reason === 'subscription_cycle' && object?.paid === true) {
    const subscriptionId = object.subscription ?? object.parent?.subscription_details?.subscription;
    const line=object.lines?.data?.find((line: any)=>line.type==='subscription'||line.parent?.type==='subscription_item_details');
    if (typeof subscriptionId === 'string' && event.id) {
      if(!line?.period?.start||!line?.period?.end)throw new Error('Invoice service period missing');
      await renewEmployerListing(env.DB, subscriptionId, event.id,new Date(line.period.start*1000),new Date(line.period.end*1000));
    }
  } else {
    await applyStripeEvent(env.DB, event);
  }
  return Response.json({ received: true });
}
