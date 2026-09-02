import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  applyStripeEvent,
  verifyStripeWebhook,
  type BillingDatabase,
} from "../../../../lib/billing/plans";

type StripeWebhookEnv = {
  DB: BillingDatabase;
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

  let event: { type?: string; data?: { object?: unknown } };
  try {
    event = JSON.parse(payload) as { type?: string; data?: { object?: unknown } };
  } catch {
    return Response.json({ code: "invalid_payload" }, { status: 400 });
  }

  await applyStripeEvent(env.DB, event);
  return Response.json({ received: true });
}
