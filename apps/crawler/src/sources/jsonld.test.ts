// @ts-expect-error Node types are not part of the crawler worker tsconfig.
import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { RateLimitedError } from "../http/public-fetch";
import { CareerJobSource } from "./career";
import { parseJobPostingJsonLd } from "./jsonld";

const PRODUCT_USER_AGENT =
  "StudioDirectBot/1.0 (+https://studio-direct.example/bot; jobs@studio-direct.example)";
const PAGE_URL = "https://pixelworks.example/careers";

const fixture = readFileSync(
  new URL("../../test/fixtures/career-jsonld.html", import.meta.url),
  "utf8",
);

describe("parseJobPostingJsonLd", () => {
  it("maps schema.org JobPosting scripts to career-page drafts", () => {
    const drafts = parseJobPostingJsonLd(fixture, "Pixel Works", PAGE_URL);

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toEqual({
      source: "career_page",
      sourceUrl:
        "https://pixelworks.example/careers/senior-tools-engineer",
      companyName: "Pixel Works",
      title: "Senior Tools Engineer",
      location: "United States",
      remote: "remote",
      descriptionHtml: "<p>Build tools for artists and designers.</p>",
      applyUrl:
        "https://pixelworks.example/careers/senior-tools-engineer",
      postedAt: "2026-09-01",
      rawJson: expect.any(String),
    });
    expect(JSON.parse(drafts[0].rawJson)).toMatchObject({
      "@type": "JobPosting",
      title: "Senior Tools Engineer",
    });
  });

  it("reads JobPosting entries from @graph and formats an address", () => {
    const [, draft] = parseJobPostingJsonLd(
      fixture,
      "Pixel Works",
      PAGE_URL,
    );

    expect(draft).toMatchObject({
      sourceUrl: "https://jobs.pixelworks.example/technical-artist",
      applyUrl: "https://jobs.pixelworks.example/technical-artist",
      location: "Montreal, Quebec, Canada",
      remote: "onsite",
      postedAt: "2026-08-28T09:00:00Z",
    });
  });
});

describe("CareerJobSource JSON-LD fallback", () => {
  it("fetches career_url with the product User-Agent when ATS is absent", async () => {
    const companyRepo = {
      getById: vi.fn(async () => ({
        id: "company:pixelworks",
        name: "Pixel Works",
        ats_type: null,
        ats_slug: null,
        career_url: PAGE_URL,
      })),
    };
    const fetchImpl = vi.fn(async () => new Response(fixture, { status: 200 }));
    const source = new CareerJobSource(companyRepo, fetchImpl);

    const drafts = await source.fetch({
      kind: "career",
      companyId: "company:pixelworks",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(1,'https://pixelworks.example/robots.txt',expect.any(Object));
    expect(fetchImpl).toHaveBeenCalledWith(PAGE_URL, {
      headers: { "user-agent": 'NodeworkBot/1.0' },
      redirect: 'manual',
      signal: expect.any(AbortSignal),
    });
    expect(drafts).toHaveLength(2);
  });

  it("propagates RateLimitedError from the career-page request", async () => {
    const companyRepo = {
      getById: vi.fn(async () => ({
        id: "company:pixelworks",
        name: "Pixel Works",
        ats_type: null,
        ats_slug: null,
        career_url: PAGE_URL,
      })),
    };
    const fetchImpl = vi.fn(
      async () =>
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "20" },
        }),
    );
    const source = new CareerJobSource(companyRepo, fetchImpl);

    const request = source.fetch({
      kind: "career",
      companyId: "company:pixelworks",
    });

    await expect(request).rejects.toBeInstanceOf(RateLimitedError);
    await expect(request).rejects.toMatchObject({
      name: "RateLimitedError",
      status: 429,
      retryAfterSeconds: 20,
    });
  });
});
