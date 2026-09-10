import type { JobDraft } from "@gaming/shared";
import { describe, expect, it } from "vitest";

import { companyProfileFromDraft, hostFromUrl, locationHierarchy } from "./web3-api";

function draft(overrides: Partial<JobDraft> = {}): JobDraft {
  return {
    source: "web3_career_api",
    sourceUrl: "https://web3.career/jobs/1",
    companyName: "Moonshot Games Studio",
    title: "Senior Backend Engineer",
    location: "Remote",
    remote: "remote",
    descriptionHtml: "<p>Build backend services.</p>",
    applyUrl: "https://boards.greenhouse.io/moonshot/jobs/1",
    postedAt: "2026-08-20T10:00:00.000Z",
    rawJson: "{}",
    externalId: "1",
    ...overrides,
  };
}

describe("hostFromUrl", () => {
  it("extracts a bare hostname and strips a leading www.", () => {
    expect(hostFromUrl("https://www.riotgames.com/careers/42")).toBe("riotgames.com");
    expect(hostFromUrl("boards.greenhouse.io/moonshot/jobs/1")).toBe(
      "boards.greenhouse.io",
    );
  });

  it("returns null for empty or unparseable input", () => {
    expect(hostFromUrl(null)).toBeNull();
    expect(hostFromUrl("")).toBeNull();
  });
});

describe("companyProfileFromDraft", () => {
  it("persists a logo_url found on the upstream payload's logo field", () => {
    const profile = companyProfileFromDraft(
      draft({ rawJson: JSON.stringify({ logo: "https://cdn.example/moonshot-logo.png" }) }),
    );
    expect(profile.logoUrl).toBe("https://cdn.example/moonshot-logo.png");
  });

  it("falls back to company_logo / logo_url fields on the upstream payload", () => {
    expect(
      companyProfileFromDraft(
        draft({ rawJson: JSON.stringify({ company_logo: "https://cdn.example/a.png" }) }),
      ).logoUrl,
    ).toBe("https://cdn.example/a.png");
    expect(
      companyProfileFromDraft(
        draft({ rawJson: JSON.stringify({ logo_url: "https://cdn.example/b.png" }) }),
      ).logoUrl,
    ).toBe("https://cdn.example/b.png");
  });

  it("derives domain from the apply URL host when the payload has no explicit domain", () => {
    const profile = companyProfileFromDraft(
      draft({
        rawJson: JSON.stringify({}),
        applyUrl: "https://boards.greenhouse.io/moonshot/jobs/1",
      }),
    );
    expect(profile.domain).toBe("boards.greenhouse.io");
  });

  it("prefers an explicit company_url field over the apply URL host", () => {
    const profile = companyProfileFromDraft(
      draft({
        rawJson: JSON.stringify({ company_url: "https://www.moonshotgames.example" }),
        applyUrl: "https://boards.greenhouse.io/moonshot/jobs/1",
      }),
    );
    expect(profile.domain).toBe("moonshotgames.example");
  });

  it("never invents a logo when the payload has none", () => {
    const profile = companyProfileFromDraft(draft({ rawJson: JSON.stringify({}) }));
    expect(profile.logoUrl).toBeNull();
  });
});

describe("locationHierarchy", () => {
  it("expands a city with a known country mapping into city, country, and region rows", () => {
    expect(locationHierarchy("berlin", "city")).toEqual([
      { slug: "berlin", kind: "city" },
      { slug: "germany", kind: "country" },
      { slug: "europe", kind: "region" },
    ]);
  });

  it("only writes the city row for a city absent from CITY_COUNTRY, never guessing a country", () => {
    expect(locationHierarchy("bhopal", "city")).toEqual([{ slug: "bhopal", kind: "city" }]);
  });

  it("expands a country into country and region rows", () => {
    expect(locationHierarchy("germany", "country")).toEqual([
      { slug: "germany", kind: "country" },
      { slug: "europe", kind: "region" },
    ]);
  });

  it("keeps a region as a single row", () => {
    expect(locationHierarchy("europe", "region")).toEqual([{ slug: "europe", kind: "region" }]);
  });
});
