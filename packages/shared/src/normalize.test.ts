import { describe, expect, it } from "vitest";
import { canonicalApplyUrl, jobPublicSlug, normalizeCompanyName, slugTitle } from "./normalize.ts";

describe("normalizeCompanyName", () => {
  it("maps Ubisoft Entertainment to ubisoft", () => {
    expect(normalizeCompanyName("Ubisoft Entertainment")).toBe("ubisoft");
  });
});

describe("canonicalApplyUrl", () => {
  it("strips tracking params", () => {
    expect(
      canonicalApplyUrl("https://jobs.example.com/x?gh_jid=1&utm_source=li"),
    ).toBe("https://jobs.example.com/x?gh_jid=1");
  });
});

describe("slugTitle", () => {
  it("slugs gameplay titles", () => {
    expect(slugTitle("Senior Gameplay Engineer (Remote)")).toBe(
      "senior-gameplay-engineer-remote",
    );
  });
});

describe("jobPublicSlug", () => {
  it("prefixes the title slug with the company slug", () => {
    expect(jobPublicSlug("Moonshot Games Studio", "Senior Software Engineer")).toBe(
      "moonshot-senior-software-engineer",
    );
    expect(jobPublicSlug("Pixel Forge Studio", "Senior Software Engineer")).toBe(
      "pixelforge-senior-software-engineer",
    );
  });
});
