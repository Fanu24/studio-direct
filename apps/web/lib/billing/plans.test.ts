import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";

import { isPaidSubscription } from "../unlocks/quota";
import {
  PLAN_COPY,
  PLAN_CURRENCY,
  applyStripeEvent,
  checkoutFormForPlan,
  isStripeCheckoutEnabled,
  planById,
  verifyStripeWebhook,
} from "./plans";

interface MemoryDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...values: unknown[]): unknown;
    run(...values: unknown[]): unknown;
  };
}

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => MemoryDatabase;
};

function createD1(database: MemoryDatabase) {
  return {
    prepare(query: string) {
      let bindings: unknown[] = [];

      return {
        bind(...values: unknown[]) {
          bindings = values;
          return this;
        },
        async first<T>(column?: string) {
          const row = database.prepare(query).get(...bindings) as
            | Record<string, T>
            | undefined;
          if (!row) return null;
          return column ? (row[column] ?? null) : (row as T);
        },
        async run() {
          const result = database.prepare(query).run(...bindings) as {
            changes?: number | bigint;
          };
          return { success: true, meta: { changes: Number(result.changes ?? 0) } };
        },
      };
    },
  };
}

function subscriptionRow(database: MemoryDatabase, userId = "user-1") {
  return database
    .prepare(
      "SELECT user_id, stripe_customer_id, stripe_status, period_end FROM subscriptions WHERE user_id = ?",
    )
    .get(userId) as {
    user_id: string;
    stripe_customer_id: string | null;
    stripe_status: string | null;
    period_end: string | null;
  } | undefined;
}

describe("PLAN_COPY", () => {
  it("uses the approved EUR monthly and yearly labels", () => {
    expect(PLAN_COPY.monthly.label).toBe("€9 / month");
    expect(PLAN_COPY.yearly.label).toBe("€59 / year");
  });

  it("is EUR only", () => {
    expect(PLAN_CURRENCY).toBe("eur");
    expect(PLAN_COPY.monthly.amountCents).toBe(900);
    expect(PLAN_COPY.yearly.amountCents).toBe(5900);
    expect(JSON.stringify(PLAN_COPY).toLowerCase()).not.toContain("usd");
    expect(JSON.stringify(PLAN_COPY)).not.toContain("$");
  });
});

describe("isStripeCheckoutEnabled", () => {
  it("is false until STRIPE_ENABLED is the string true", () => {
    expect(isStripeCheckoutEnabled(undefined)).toBe(false);
    expect(isStripeCheckoutEnabled("")).toBe(false);
    expect(isStripeCheckoutEnabled("false")).toBe(false);
    expect(isStripeCheckoutEnabled("FALSE")).toBe(false);
    expect(isStripeCheckoutEnabled("1")).toBe(false);
    expect(isStripeCheckoutEnabled("true")).toBe(true);
  });
});

describe("planById", () => {
  it("resolves monthly and yearly and rejects anything else", () => {
    expect(planById("monthly")).toBe(PLAN_COPY.monthly);
    expect(planById("yearly")).toBe(PLAN_COPY.yearly);
    expect(planById("weekly")).toBeNull();
    expect(planById(undefined)).toBeNull();
  });
});

describe("checkoutFormForPlan", () => {
  it("posts a monthly EUR subscription without USD prices", () => {
    const body = checkoutFormForPlan(PLAN_COPY.monthly, {
      userId: "user-1",
      email: "ada@example.com",
      successUrl: "https://jobs.example.com/pricing?checkout=success",
      cancelUrl: "https://jobs.example.com/pricing?checkout=cancel",
    });

    expect(body.get("mode")).toBe("subscription");
    expect(body.get("line_items[0][price_data][currency]")).toBe("eur");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("900");
    expect(body.get("line_items[0][price_data][recurring][interval]")).toBe("month");
    expect(body.get("client_reference_id")).toBe("user-1");
    expect(body.get("line_items[0][price_data][currency]")).not.toBe("usd");
    expect(decodeURIComponent(body.toString()).toLowerCase()).not.toContain("usd");
  });

  it("posts a yearly EUR subscription at 5900 cents", () => {
    const body = checkoutFormForPlan(PLAN_COPY.yearly, {
      userId: "user-1",
      email: "ada@example.com",
      successUrl: "https://jobs.example.com/pricing?checkout=success",
      cancelUrl: "https://jobs.example.com/pricing?checkout=cancel",
    });

    expect(body.get("line_items[0][price_data][currency]")).toBe("eur");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("5900");
    expect(body.get("line_items[0][price_data][recurring][interval]")).toBe("year");
  });
});

describe("verifyStripeWebhook", () => {
  const payload = JSON.stringify({ type: "ping" });
  const secret = "whsec_test";

  it("accepts a valid v1 signature within tolerance", () => {
    const timestamp = 1_778_000_000;
    const signed = `${timestamp}.${payload}`;
    const v1 = createHmac("sha256", secret).update(signed).digest("hex");

    expect(
      verifyStripeWebhook({
        payload,
        header: `t=${timestamp},v1=${v1}`,
        secret,
        now: new Date(timestamp * 1000),
      }),
    ).toBe(true);
  });

  it("rejects a missing, wrong, or stale signature", () => {
    const timestamp = 1_778_000_000;
    const signed = `${timestamp}.${payload}`;
    const v1 = createHmac("sha256", secret).update(signed).digest("hex");

    expect(
      verifyStripeWebhook({
        payload,
        header: undefined,
        secret,
        now: new Date(timestamp * 1000),
      }),
    ).toBe(false);
    expect(
      verifyStripeWebhook({
        payload,
        header: `t=${timestamp},v1=deadbeef`,
        secret,
        now: new Date(timestamp * 1000),
      }),
    ).toBe(false);
    expect(
      verifyStripeWebhook({
        payload,
        header: `t=${timestamp},v1=${v1}`,
        secret,
        now: new Date((timestamp + 400) * 1000),
      }),
    ).toBe(false);
  });
});

describe("applyStripeEvent", () => {
  const now = new Date("2026-09-02T12:00:00.000Z");
  let sqlite: MemoryDatabase;
  let db: ReturnType<typeof createD1>;

  beforeEach(() => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE subscriptions (
        user_id TEXT PRIMARY KEY,
        stripe_customer_id TEXT,
        stripe_status TEXT,
        period_end TEXT
      );
    `);
    db = createD1(sqlite);
  });

  it("stores customer id, active status, and period_end from a subscription update", async () => {
    await applyStripeEvent(db, {
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_paid",
          status: "active",
          current_period_end: Math.floor(Date.parse("2026-10-01T00:00:00.000Z") / 1000),
          metadata: { userId: "user-1" },
        },
      },
    });

    const row = subscriptionRow(sqlite);
    expect(row).toEqual({
      user_id: "user-1",
      stripe_customer_id: "cus_paid",
      stripe_status: "active",
      period_end: "2026-10-01T00:00:00.000Z",
    });
    expect(isPaidSubscription(row, now)).toBe(true);
  });

  it("keeps quota on the free tier for incomplete or canceled subscriptions", async () => {
    await applyStripeEvent(db, {
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_new",
          client_reference_id: "user-1",
          metadata: { userId: "user-1" },
        },
      },
    });

    const incomplete = subscriptionRow(sqlite);
    expect(incomplete?.stripe_customer_id).toBe("cus_new");
    expect(incomplete?.stripe_status).not.toBe("active");
    expect(isPaidSubscription(incomplete, now)).toBe(false);

    await applyStripeEvent(db, {
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_new",
          status: "incomplete",
          current_period_end: Math.floor(Date.parse("2026-10-01T00:00:00.000Z") / 1000),
        },
      },
    });
    expect(isPaidSubscription(subscriptionRow(sqlite), now)).toBe(false);

    await applyStripeEvent(db, {
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: "cus_new",
          status: "canceled",
          current_period_end: Math.floor(Date.parse("2026-10-01T00:00:00.000Z") / 1000),
        },
      },
    });
    expect(isPaidSubscription(subscriptionRow(sqlite), now)).toBe(false);
  });

  it("does not write a paid row when the event cannot be mapped to a user", async () => {
    const applied = await applyStripeEvent(db, {
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_orphan",
          status: "active",
          current_period_end: Math.floor(Date.parse("2026-10-01T00:00:00.000Z") / 1000),
        },
      },
    });

    expect(applied).toBe(false);
    expect(subscriptionRow(sqlite)).toBeUndefined();
  });
});
