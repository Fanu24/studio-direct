// @ts-expect-error Node types are not part of the crawler worker tsconfig.
import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { RateLimitedError } from "../http/public-fetch";
import { CareerJobSource } from "./career";
import {
  fetchLeverPostings,
  leverPostingsUrl,
  parseLeverPostings,
} from "./lever";

const PRODUCT_USER_AGENT =
  "StudioDirectBot/1.0 (+https://studio-direct.example/bot; jobs@studio-direct.example)";

const fixture = readFileSync(
  new URL("../../test/fixtures/lever-postings.json", import.meta.url),
  "utf8",
);

describe("parseLeverPostings", () => {
  it("maps Lever postings to career-page drafts", () => {
    const drafts = parseLeverPostings(fixture, "Pixel Works");

    expect(drafts).toHaveLength(3);
    expect(drafts[0]).toMatchObject({
      source: "career_page",
      sourceUrl: "https://jobs.lever.co/pixelworks/lever-101",
      companyName: "Pixel Works",
      title: "Senior Backend Engineer",
      location: "United States",
      remote: "remote",
      descriptionHtml:
        "<p>Build reliable services for our online games.</p>",
      applyUrl: "https://jobs.lever.co/pixelworks/lever-101/apply",
      postedAt: new Date(1788167700000).toISOString(),
    });
  });

  it("maps structured hybrid workplace types", () => {
    const [, hybrid] = parseLeverPostings(fixture, "Pixel Works");

    expect(hybrid.remote).toBe("hybrid");
    expect(hybrid.location).toBe("Berlin");
  });

  it("maps missing timestamps to null and structured onsite types", () => {
    const [, , onsite] = parseLeverPostings(fixture, "Pixel Works");

    expect(onsite.remote).toBe("onsite");
    expect(onsite.location).toBe("Montreal, Quebec, Canada");
    expect(onsite.postedAt).toBeNull();
  });
});

describe("CareerJobSource", () => {
  it("dispatches a career message to Lever with injected fetch", async () => {
    const companyRepo = {
      getById: vi.fn(async () => ({
        id: "company:pixelworks",
        name: "Pixel Works",
        ats_type: "lever",
        ats_slug: "pixelworks",
      })),
    };
    const fetchImpl = vi.fn(
      async () =>
        new Response(fixture, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const source = new CareerJobSource(companyRepo, fetchImpl);

    const drafts = await source.fetch({
      kind: "career",
      companyId: "company:pixelworks",
    });

    expect(companyRepo.getById).toHaveBeenCalledWith("company:pixelworks");
    expect(fetchImpl).toHaveBeenCalledWith(leverPostingsUrl("pixelworks"), {
      method: "GET",
      headers: { "User-Agent": PRODUCT_USER_AGENT },
      signal: expect.any(AbortSignal),
    });
    expect(drafts).toHaveLength(3);
  });
});

describe("fetchLeverPostings", () => {
  it("propagates RateLimitedError for a 429 response", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "45" },
        }),
    );

    const request = fetchLeverPostings(
      "pixelworks",
      "Pixel Works",
      fetchImpl,
    );

    await expect(request).rejects.toBeInstanceOf(RateLimitedError);
    await expect(request).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 45,
    });
  });
});
