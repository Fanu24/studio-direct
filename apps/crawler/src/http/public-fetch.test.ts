import { describe, expect, it, vi } from "vitest";
import {
  fetchPublicText,
  RateLimitedError,
  retryDelaySeconds,
} from "./public-fetch";

const PRODUCT_USER_AGENT =
  "StudioDirectBot/1.0 (+https://studio-direct.example/bot; jobs@studio-direct.example)";

describe("fetchPublicText", () => {
  it("returns the status and body for a successful response", async () => {
    const fetchImpl = vi.fn(async () => new Response("job body", { status: 200 }));

    await expect(
      fetchPublicText("https://example.test/jobs", fetchImpl, PRODUCT_USER_AGENT),
    ).resolves.toEqual({ status: 200, body: "job body" });
  });

  it("throws RateLimitedError for a 403 response", async () => {
    const fetchImpl = vi.fn(async () => new Response("blocked", { status: 403 }));

    await expect(
      fetchPublicText("https://example.test/jobs", fetchImpl, PRODUCT_USER_AGENT),
    ).rejects.toMatchObject({
      name: "RateLimitedError",
      status: 403,
      retryAfterSeconds: null,
    });
  });

  it("sends a GET with only the product User-Agent", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));

    await fetchPublicText(
      "https://example.test/jobs",
      fetchImpl,
      PRODUCT_USER_AGENT,
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith("https://example.test/jobs", {
      method: "GET",
      headers: { "User-Agent": PRODUCT_USER_AGENT },
    });
  });
});

describe("retryDelaySeconds", () => {
  it("returns the Retry-After delay from a rate-limit error", () => {
    const error = new RateLimitedError(429, 45);

    expect(retryDelaySeconds(error)).toBe(45);
  });

  it("returns null for other errors", () => {
    expect(retryDelaySeconds(new Error("network failure"))).toBeNull();
  });
});
