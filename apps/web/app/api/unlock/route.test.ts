import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getSession: vi.fn(),
  first: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../../lib/auth/index", () => ({
  createAuth: () => ({
    api: {
      getSession: mocks.getSession,
    },
  }),
}));

const applyUrl = "https://studio.example/careers/secret-apply";

describe("POST /api/unlock onboarding gate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.first.mockResolvedValue(null);
    mocks.getCloudflareContext.mockResolvedValue({
      env: {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              first: mocks.first,
            })),
          })),
        },
        BETTER_AUTH_SECRET: "auth-secret",
        GOOGLE_CLIENT_ID: "google-client-id",
        GOOGLE_CLIENT_SECRET: "google-client-secret",
        EMAIL_FROM: "noreply@example.com",
        EMAIL: { send: vi.fn() },
      },
    });
  });

  function unlockRequest() {
    return new Request("http://localhost/api/unlock", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        jobId: "job-1",
        next: "/jobs/gameplay-engineer",
      }),
    });
  }

  it("redirects to login without leaking apply_url when there is no session", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.first.mockResolvedValue({ apply_url: applyUrl });

    const { POST } = await import("./route");
    const response = await POST(unlockRequest());
    const location = response.headers.get("location");
    const body = await response.text();

    expect(response.status).toBe(303);
    expect(location).toMatch(/\/login$/);
    expect(location).not.toContain(applyUrl);
    expect(body).not.toContain(applyUrl);
  });

  it("redirects to /onboarding?next= when the session user needs onboarding", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.first.mockResolvedValue({
      display_name: null,
      target_role: null,
      remote_pref: null,
      apply_url: applyUrl,
    });

    const { POST } = await import("./route");
    const response = await POST(unlockRequest());
    const location = response.headers.get("location");
    const redirected = new URL(location!, "http://localhost");
    const body = await response.text();

    expect(response.status).toBe(303);
    expect(redirected.pathname).toBe("/onboarding");
    expect(redirected.searchParams.get("next")).toBe("/jobs/gameplay-engineer");
    expect(location).not.toContain(applyUrl);
    expect(body).not.toContain(applyUrl);
  });

  it("hands off to quota later without revealing apply_url when already onboarded", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.first.mockResolvedValue({
      display_name: "Ada",
      target_role: "Gameplay Programmer",
      remote_pref: "remote",
      apply_url: applyUrl,
    });

    const { POST } = await import("./route");
    const response = await POST(unlockRequest());
    const body = await response.text();

    expect(response.status).toBe(501);
    expect(body).not.toContain(applyUrl);
    expect(body.toLowerCase()).not.toContain("stripe");
  });
});
