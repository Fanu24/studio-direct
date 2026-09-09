import { describe, expect, it } from "vitest";

import { buildLandingDescription, buildLandingTitle } from "./landing-meta";

describe("buildLandingTitle", () => {
  it("joins the headline and month without a New suffix when nothing is new", () => {
    expect(
      buildLandingTitle({ headline: "Solidity Jobs", month: "Sep 2026", newJobs: 0 }),
    ).toBe("Solidity Jobs - Sep 2026");
  });

  it("appends the New count when jobs posted recently", () => {
    expect(
      buildLandingTitle({ headline: "Solidity Jobs", month: "Sep 2026", newJobs: 4 }),
    ).toBe("Solidity Jobs - Sep 2026 (4 New)");
  });
});

describe("buildLandingDescription", () => {
  const jobs = [
    { companyName: "Alpha Studio", title: "Senior Solidity Engineer" },
    { companyName: "Beta Labs", title: "Solidity Developer" },
    { companyName: "Alpha Studio", title: "Smart Contract Engineer" },
    { companyName: "Gamma DAO", title: "Protocol Engineer" },
    { companyName: "Delta Chain", title: "Blockchain Engineer" },
    { companyName: "Epsilon Games", title: "Senior Blockchain Developer" },
  ];

  it("formats the live count and names up to 3 companies and 5 titles", () => {
    const description = buildLandingDescription({
      topic: "solidity jobs in web3",
      month: "Sep 2026",
      total: 1234,
      salaryRange: null,
      jobs,
    });

    expect(description).toContain("1,234 solidity jobs in web3 live on Nodework for Sep 2026.");
    expect(description).toContain("Alpha Studio, Beta Labs and Gamma DAO");
    expect(description).not.toContain("Delta Chain");
    expect(description).toContain(
      "Senior Solidity Engineer, Solidity Developer, Smart Contract Engineer, Protocol Engineer and Blockchain Engineer",
    );
    expect(description).not.toContain("Senior Blockchain Developer");
  });

  it("singularizes the topic for a count of exactly 1", () => {
    const description = buildLandingDescription({
      topic: "solidity jobs in web3",
      month: "Sep 2026",
      total: 1,
      salaryRange: null,
      jobs: [],
    });

    expect(description).toBe("1 solidity job in web3 live on Nodework for Sep 2026.");
  });

  it("adds a salary clause only when a range is given", () => {
    const withRange = buildLandingDescription({
      topic: "solidity jobs in web3",
      month: "Sep 2026",
      total: 12,
      salaryRange: "$90k - $160k",
      jobs: [],
    });
    const withoutRange = buildLandingDescription({
      topic: "solidity jobs in web3",
      month: "Sep 2026",
      total: 12,
      salaryRange: null,
      jobs: [],
    });

    expect(withRange).toContain("with published salaries spanning $90k - $160k");
    expect(withoutRange).not.toContain("published salaries");
  });

  it("omits company and title sentences when no jobs are sampled", () => {
    const description = buildLandingDescription({
      topic: "web3 jobs in berlin, germany",
      month: "Sep 2026",
      total: 0,
      salaryRange: null,
      jobs: [],
    });

    expect(description).toBe("0 web3 jobs in berlin, germany live on Nodework for Sep 2026.");
    expect(description).not.toContain("Companies hiring");
    expect(description).not.toContain("Open roles");
  });
});
