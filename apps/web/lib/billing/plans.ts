import { TENANT_NAME } from "@gaming/shared";
import { createHmac, timingSafeEqual } from "node:crypto";

export const PLAN_CURRENCY = "eur" as const;

export const PLAN_COPY = {
  monthly: {
    id: "monthly",
    label: "€9 / month",
    amountCents: 900,
    interval: "month",
  },
  yearly: {
    id: "yearly",
    label: "€59 / year",
    amountCents: 5900,
    interval: "year",
  },
} as const;

export type PlanId = keyof typeof PLAN_COPY;
export type Plan = (typeof PLAN_COPY)[PlanId];

export type BillingDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(column?: string): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};

export function isStripeCheckoutEnabled(value: string | undefined | null): boolean {
  return value === "true";
}

export function planById(id: string | null | undefined): Plan | null {
  if (id === "monthly" || id === "yearly") return PLAN_COPY[id];
  return null;
}

export function checkoutFormForPlan(
  plan: Plan,
  {
    userId,
    email,
    successUrl,
    cancelUrl,
  }: {
    userId: string;
    email?: string | null;
    successUrl: string;
    cancelUrl: string;
  },
): URLSearchParams {
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("success_url", successUrl);
  body.set("cancel_url", cancelUrl);
  body.set("client_reference_id", userId);
  body.set("metadata[userId]", userId);
  body.set("subscription_data[metadata][userId]", userId);
  if (email) body.set("customer_email", email);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", PLAN_CURRENCY);
  body.set("line_items[0][price_data][unit_amount]", String(plan.amountCents));
  body.set("line_items[0][price_data][product_data][name]", TENANT_NAME);
  body.set("line_items[0][price_data][recurring][interval]", plan.interval);
  return body;
}

function safeEqualHex(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyStripeWebhook({
  payload,
  header,
  secret,
  now = new Date(),
  toleranceSeconds = 300,
}: {
  payload: string;
  header: string | null | undefined;
  secret: string;
  now?: Date;
  toleranceSeconds?: number;
}): boolean {
  if (!header || !secret) return false;

  const parts = header.split(",").map((item) => {
    const separator = item.indexOf("=");
    if (separator === -1) return ["", ""] as const;
    return [item.slice(0, separator).trim(), item.slice(separator + 1).trim()] as const;
  });
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(now.getTime() / 1000 - ts) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return signatures.some((signature) => safeEqualHex(signature, expected));
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function unixToIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function periodEndIso(object: JsonObject): string | null {
  const direct = unixToIso(object.current_period_end);
  if (direct) return direct;

  const items = asObject(object.items);
  const data = items && Array.isArray(items.data) ? items.data : [];
  const first = asObject(data[0]);
  return first ? unixToIso(first.current_period_end) : null;
}

function userIdFrom(object: JsonObject): string | null {
  const metadata = asObject(object.metadata);
  return text(metadata?.userId) ?? text(object.client_reference_id);
}

async function upsertSubscription(
  db: BillingDatabase,
  {
    userId,
    stripeCustomerId,
    stripeStatus,
    periodEnd,
  }: {
    userId: string;
    stripeCustomerId: string | null;
    stripeStatus: string | null;
    periodEnd: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_status, period_end)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         stripe_customer_id = COALESCE(excluded.stripe_customer_id, subscriptions.stripe_customer_id),
         stripe_status = COALESCE(excluded.stripe_status, subscriptions.stripe_status),
         period_end = COALESCE(excluded.period_end, subscriptions.period_end)`,
    )
    .bind(userId, stripeCustomerId, stripeStatus, periodEnd)
    .run();
}

export async function applyStripeEvent(
  db: BillingDatabase,
  event: { type?: string; data?: { object?: unknown } },
): Promise<boolean> {
  const object = asObject(event.data?.object);
  if (!object) return false;

  if (event.type === "checkout.session.completed") {
    const userId = userIdFrom(object);
    if (!userId) return false;
    const subscription = asObject(object.subscription);
    await upsertSubscription(db, {
      userId,
      stripeCustomerId: text(object.customer),
      stripeStatus: subscription ? text(subscription.status) : null,
      periodEnd: subscription ? periodEndIso(subscription) : null,
    });
    return true;
  }

  if (
    event.type === "customer.subscription.created"
    || event.type === "customer.subscription.updated"
    || event.type === "customer.subscription.deleted"
  ) {
    const customerId = text(object.customer);
    let userId = userIdFrom(object);
    if (!userId && customerId) {
      userId = await db
        .prepare(
          `SELECT user_id
           FROM subscriptions
           WHERE stripe_customer_id = ?`,
        )
        .bind(customerId)
        .first<string>("user_id");
    }
    if (!userId) return false;

    await upsertSubscription(db, {
      userId,
      stripeCustomerId: customerId,
      stripeStatus: text(object.status),
      periodEnd: periodEndIso(object),
    });
    return true;
  }

  return false;
}
