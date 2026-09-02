// @ts-expect-error Node types are not part of the crawler worker tsconfig.
import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { RateLimitedError } from "../http/public-fetch";
import {
  fetchGreenhouseBoard,
  greenhouseBoardUrl,
  parseGreenhouseBoard,
} from "./greenhouse";
import { CareerJobSource } from "./career";

const PRODUCT_USER_AGENT =
  "StudioDirectBot/1.0 (+https://studio-direct.example/bot; jobs@studio-direct.example)";

const fixture = readFileSync(
  new URL("../../test/fixtures/greenhouse-board.json", import.meta.url),
  "utf8",
);

describe("parseGreenhouseBoard", () => {
  it("maps Greenhouse jobs to career-page drafts", () => {
    const drafts = parseGreenhouseBoard(fixture, "Pixel Works");

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      source: "career_page",
      sourceUrl: "https://job-boards.greenhouse.io/pixelworks/jobs/101",
      companyName: "Pixel Works",
      title: "Senior Gameplay Engineer",
      location: "Remote - US",
      remote: "remote",
      descriptionHtml:
        "<p>Build responsive gameplay systems for our next title.</p>",
      applyUrl: "https://job-boards.greenhouse.io/pixelworks/jobs/101",
      postedAt: "2026-08-30T10:15:00-04:00",
    });
  });

  it("does not classify an onsite location as remote", () => {
    const [, onsite] = parseGreenhouseBoard(fixture, "Pixel Works");

    expect(onsite.remote).toBe("onsite");
    expect(onsite.location).toBe(
      "Los Angeles, California, United States",
    );
  });
});

describe("CareerJobSource", () => {
  it("dispatches a career message to Greenhouse with injected fetch", async () => {
    const companyRepo = {
      getById: vi.fn(async () => ({
        id: "company:pixelworks",
        name: "Pixel Works",
        ats_type: "greenhouse",
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
    expect(fetchImpl).toHaveBeenCalledWith(greenhouseBoardUrl("pixelworks"), {
      method: "GET",
      headers: { "User-Agent": PRODUCT_USER_AGENT },
    });
    expect(drafts).toHaveLength(2);
  });
});

describe("fetchGreenhouseBoard", () => {
  it("propagates RateLimitedError for a 429 response", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "30" },
        }),
    );

    const request = fetchGreenhouseBoard(
      "pixelworks",
      "Pixel Works",
      fetchImpl,
    );

    await expect(request).rejects.toBeInstanceOf(RateLimitedError);
    await expect(request).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 30,
    });
  });
});
