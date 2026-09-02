import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createAuth, type AuthEnv } from "../../../../lib/auth/index";
import {
  checkoutFormForPlan,
  isStripeCheckoutEnabled,
  planById,
} from "../../../../lib/billing/plans";

type StripeCheckoutEnv = AuthEnv & {
  STRIPE_ENABLED?: string;
  STRIPE_SECRET_KEY?: string;
  SITE_URL?: string;
};

async function checkoutEnv(): Promise<StripeCheckoutEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as StripeCheckoutEnv;
}

function checkoutOrigin(env: StripeCheckoutEnv, request: Request): string {
  const configured = env.SITE_URL || env.BETTER_AUTH_URL;
  const raw = configured?.trim() || new URL(request.url).origin;
  return raw.replace(/\/$/, "");
}

async function readPlanId(request: Request): Promise<string | undefined> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await request.json()) as { plan?: unknown };
    return typeof json.plan === "string" ? json.plan : undefined;
  }

  const form = await request.formData();
  const plan = form.get("plan");
  return typeof plan === "string" ? plan : undefined;
}

export async function POST(request: Request) {
  const env = await checkoutEnv();

  if (!isStripeCheckoutEnabled(env.STRIPE_ENABLED)) {
    return Response.json({ code: "billing_disabled" }, { status: 503 });
  }

  const session = await createAuth(env).api.getSession({
    headers: request.headers,
  });
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ code: "unauthorized" }, { status: 401 });
  }

  const plan = planById(await readPlanId(request));
  if (!plan) {
    return Response.json({ code: "invalid_plan" }, { status: 400 });
  }

  if (!env.STRIPE_SECRET_KEY) {
    return Response.json({ code: "billing_disabled" }, { status: 503 });
  }

  const origin = checkoutOrigin(env, request);
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: checkoutFormForPlan(plan, {
      userId,
      email: session.user.email,
      successUrl: `${origin}/pricing?checkout=success`,
      cancelUrl: `${origin}/pricing?checkout=cancel`,
    }),
  });

  if (!response.ok) {
    return Response.json({ code: "checkout_failed" }, { status: 502 });
  }

  const created = (await response.json()) as { url?: string };
  if (!created.url) {
    return Response.json({ code: "checkout_failed" }, { status: 502 });
  }

  return Response.json({ url: created.url });
}
