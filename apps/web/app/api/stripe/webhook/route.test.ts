import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isPaidSubscription } from "../../../../lib/unlocks/quota";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

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

const webhookSecret = "whsec_test_secret";

function sign(payload: string, timestamp = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return { header: `t=${timestamp},v1=${v1}`, timestamp };
}

function webhookRequest(payload: string, header?: string) {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(header ? { "stripe-signature": header } : {}),
    },
    body: payload,
  });
}

describe("POST /api/stripe/webhook", () => {
  let sqlite: MemoryDatabase;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE subscriptions (
        user_id TEXT PRIMARY KEY,
        stripe_customer_id TEXT,
        stripe_status TEXT,
        period_end TEXT
      );
    `);
    mocks.getCloudflareContext.mockResolvedValue({
      env: {
        DB: createD1(sqlite),
        STRIPE_WEBHOOK_SECRET: webhookSecret,
        STRIPE_ENABLED: "false",
      },
    });
  });

  function row() {
    return sqlite
      .prepare(
        "SELECT user_id, stripe_customer_id, stripe_status, period_end FROM subscriptions WHERE user_id = ?",
      )
      .get("user-1") as {
      user_id: string;
      stripe_customer_id: string | null;
      stripe_status: string | null;
      period_end: string | null;
    } | undefined;
  }

  it("rejects an invalid signature without writing a subscription", async () => {
    const payload = JSON.stringify({
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_paid",
          status: "active",
          current_period_end: 1790000000,
          metadata: { userId: "user-1" },
        },
      },
    });
    const { POST } = await import("./route");
    const response = await POST(webhookRequest(payload, "t=1,v1=nope"));

    expect(response.status).toBe(400);
    expect(row()).toBeUndefined();
  });

  it("upserts subscriptions from a signed active event", async () => {
    const payload = JSON.stringify({
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
    const { header } = sign(payload);
    const { POST } = await import("./route");
    const response = await POST(webhookRequest(payload, header));

    expect(response.status).toBe(200);
    expect(row()).toEqual({
      user_id: "user-1",
      stripe_customer_id: "cus_paid",
      stripe_status: "active",
      period_end: "2026-10-01T00:00:00.000Z",
    });
    expect(
      isPaidSubscription(row(), new Date("2026-09-02T12:00:00.000Z")),
    ).toBe(true);
  });

  it("leaves quota on the free tier when checkout completes without an active period", async () => {
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_new",
          client_reference_id: "user-1",
          metadata: { userId: "user-1" },
        },
      },
    });
    const { header } = sign(payload);
    const { POST } = await import("./route");
    const response = await POST(webhookRequest(payload, header));

    expect(response.status).toBe(200);
    expect(isPaidSubscription(row(), new Date("2026-09-02T12:00:00.000Z"))).toBe(
      false,
    );
  });
});
