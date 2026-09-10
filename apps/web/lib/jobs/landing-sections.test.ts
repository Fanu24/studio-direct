import { parseLandingSegment } from "@gaming/shared";
import { describe, expect, it } from "vitest";

import { buildLandingRelatedLinks, buildLandingStats } from "./landing-sections";

function landing(segment: string) {
  const parsed = parseLandingSegment(segment);
  if (!parsed) throw new Error(`not a landing: ${segment}`);
  return parsed;
}

const EXTRAS = {
  salaryHref: "/web3-salaries/solidity-developer",
  salaryLabel: "Solidity salaries",
};

describe("buildLandingStats", () => {
  it("always returns four cells so the four-column grid never orphans one", () => {
    const stats = buildLandingStats({
      total: 0,
      newThisWeek: 0,
      jobs: [],
    });
    expect(stats).toHaveLength(4);
    expect(stats.map((stat) => stat.label)).toEqual([
      "Open roles",
      "Posted this week",
      "Salary range",
      "Companies on this page",
    ]);
  });

  it("prints the rollup band, its average and its sample size", () => {
    const stats = buildLandingStats({
      total: 1234,
      newThisWeek: 7,
      salaryRange: "$80k - $200k",
      averageSalary: "$140k",
      pricedRoles30d: 46,
      jobs: [
        { companyName: "Alpha Studio" },
        { companyName: "Alpha Studio" },
        { companyName: "Beta Labs" },
      ],
    });

    expect(stats[0]).toMatchObject({ value: "1,234" });
    expect(stats[1]).toMatchObject({ value: "7" });
    expect(stats[2]!.value).toBe("$80k - $200k");
    expect(stats[2]!.hint).toContain("averaging $140k");
    expect(stats[2]!.hint).toContain("46 priced roles");
    // Two rows share a company, so the honest number is 2, not 3.
    expect(stats[3]!.value).toBe("2");
    expect(stats[3]!.hint).toContain("3 listings");
  });

  it("says so plainly when no rollup covers the slice", () => {
    const stats = buildLandingStats({
      total: 3,
      newThisWeek: 0,
      salaryRange: null,
      jobs: [{ companyName: "Alpha Studio" }],
    });
    expect(stats[2]!.value).toBe("Not published");
    expect(stats[2]!.hint).toContain("No salary rollup");
    expect(stats[1]!.hint).toContain("Nothing new");
    expect(stats[3]!.hint).toContain("1 listing");
  });
});

describe("buildLandingRelatedLinks", () => {
  it("stays inside the 5-10 links the spec asks for", () => {
    for (const segment of [
      "solidity-jobs",
      "remote-jobs",
      "remote+solidity-jobs",
      "dev+junior-jobs",
      "web3-jobs-berlin",
      "web3-jobs-spain",
      "web3-jobs-europe",
      "intern-jobs",
      "entry-level-jobs",
      "pay-in-crypto-jobs",
    ]) {
      const links = buildLandingRelatedLinks(landing(segment), EXTRAS);
      expect(links.length).toBeGreaterThanOrEqual(5);
      expect(links.length).toBeLessThanOrEqual(10);
      expect(new Set(links.map((link) => link.href)).size).toBe(links.length);
      expect(links.map((link) => link.href)).not.toContain(`/${segment}`);
    }
  });

  it("is contextual: a tag landing offers its own remote variant", () => {
    const hrefs = buildLandingRelatedLinks(landing("solidity-jobs"), EXTRAS).map(
      (link) => link.href,
    );
    expect(hrefs).toContain("/remote-jobs");
    expect(hrefs).toContain("/remote+solidity-jobs");
    expect(hrefs).toContain("/web3-salaries/solidity-developer");
    expect(hrefs).toContain("/web3-companies");
  });

  it("a combo landing links each of its component facets", () => {
    const hrefs = buildLandingRelatedLinks(landing("dev+junior-jobs"), EXTRAS).map(
      (link) => link.href,
    );
    expect(hrefs).toContain("/dev-jobs");
    expect(hrefs).toContain("/junior-jobs");
  });

  it("a city landing climbs to its country and region", () => {
    const hrefs = buildLandingRelatedLinks(landing("web3-jobs-berlin"), EXTRAS).map(
      (link) => link.href,
    );
    expect(hrefs).toContain("/web3-jobs-germany");
    expect(hrefs).toContain("/web3-jobs-europe");
  });

  it("tops up with region hubs when the contextual set is thin", () => {
    const hrefs = buildLandingRelatedLinks(landing("intern-jobs"), EXTRAS).map(
      (link) => link.href,
    );
    expect(hrefs).toContain("/web3-jobs-asia");
    expect(hrefs.length).toBeGreaterThanOrEqual(9);
  });
});
