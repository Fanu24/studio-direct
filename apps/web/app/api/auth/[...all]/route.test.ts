import { describe, expect, it, vi } from "vitest";

describe("auth route Turnstile gate", () => {
  it("returns 400 when a magic-link POST has no Turnstile token", async () => {
    vi.resetModules();
    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: vi.fn().mockResolvedValue({
        env: {
          TURNSTILE_SECRET_KEY: "turnstile-secret",
          BETTER_AUTH_SECRET: "auth-secret",
          GOOGLE_CLIENT_ID: "google-client-id",
          GOOGLE_CLIENT_SECRET: "google-client-secret",
          EMAIL_FROM: "noreply@example.com",
          DB: {},
          EMAIL: { send: vi.fn() },
        },
      }),
    }));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "dev@example.com" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Turnstile token is required",
    });
  });
});
