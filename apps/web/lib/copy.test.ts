import { describe, expect, it } from "vitest";

import { HOMEPAGE_CLAIM, LINKEDIN_EXCLUSIVITY_TOOLTIP, homepageSummary } from "./copy";

describe("HOMEPAGE_CLAIM", () => {
  it("uses the approved career-page claim verbatim", () => {
    expect(HOMEPAGE_CLAIM).toBe(
      "Browse Web3, blockchain and crypto jobs. Filter by skill, location and salary.",
    );
  });

  it("does not make a 100% claim", () => {
    expect(HOMEPAGE_CLAIM).not.toContain("100%");
  });
});

describe("LINKEDIN_EXCLUSIVITY_TOOLTIP", () => {
  it("uses the approved last-index qualification verbatim", () => {
    expect(LINKEDIN_EXCLUSIVITY_TOOLTIP).toBe(
      "We did not find this role on LinkedIn in our last successful index.",
    );
  });
});

describe("homepageSummary", () => {
  it("embeds the live job and company counts", () => {
    const summary = homepageSummary(1042, 315);

    expect(summary).toContain("1,042");
    expect(summary).toContain("315");
  });

  it("pluralises singular counts correctly", () => {
    expect(homepageSummary(1, 1)).toContain("1 live Web3 job from 1 hiring company");
    expect(homepageSummary(2, 2)).toContain("2 live Web3 jobs from 2 hiring companies");
  });

  it("is original copy, not the web3.career sentence it replaces", () => {
    const summary = homepageSummary(1042, 315);

    expect(summary).not.toContain("Browse");
    expect(summary).not.toContain("blockchain jobs in web3 at");
  });

  it("does not use an em dash or en dash", () => {
    expect(homepageSummary(1042, 315)).not.toMatch(/[–—]/);
  });
});
