import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getSession: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../../../lib/auth/index", () => ({
  createAuth: () => ({
    api: {
      getSession: mocks.getSession,
    },
  }),
}));

function env(overrides: Record<string, unknown> = {}) {
  return {
    env: {
      DB: {},
      BETTER_AUTH_SECRET: "auth-secret",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      EMAIL_FROM: "noreply@example.com",
      EMAIL: { send: vi.fn() },
      STRIPE_ENABLED: "false",
      STRIPE_SECRET_KEY: "sk_test_placeholder",
      SITE_URL: "https://jobs.example.com",
      ...overrides,
    },
  };
}

function checkoutRequest(plan = "monthly") {
  return new Request("http://localhost/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan }),
  });
}

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      user: { id: "user-1", email: "ada@example.com" },
    });
    mocks.getCloudflareContext.mockResolvedValue(env());
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ id: "cs_test", url: "https://checkout.stripe.com/c/cs_test" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("returns 503 and never calls Stripe when STRIPE_ENABLED is not true", async () => {
    const { POST } = await import("./route");
    const response = await POST(checkoutRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ code: "billing_disabled" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns 503 when STRIPE_ENABLED is missing", async () => {
    mocks.getCloudflareContext.mockResolvedValue(env({ STRIPE_ENABLED: undefined }));
    const { POST } = await import("./route");
    const response = await POST(checkoutRequest());

    expect(response.status).toBe(503);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
