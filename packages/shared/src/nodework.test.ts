import { describe, expect, it } from "vitest";

import { careerFaq } from "./copy/faq.ts";
import { roleWhatTheyDo } from "./copy/role-blurbs.ts";
import {
  landingFaq,
  landingHeadline,
  parseLandingSegment,
  parseSalaryPageSlug,
  SEO_MIN_JOBS,
  shouldIndexLanding,
} from "./landings.ts";
import { jobSeoSlug } from "./normalize.ts";
import { averageSalary, parseSalaryBounds } from "./salary.ts";
import {
  FEATURED_TAG_CHIPS,
  SALARY_ROLES,
  SALARY_ROLE_ALIASES,
  canonicalSalaryRole,
  isJobTag,
  isCitySlug,
  isCountrySlug,
  isNonTechSalaryRole,
  isRegionSlug,
  isSalaryRole,
  isSenioritySlug,
} from "./taxonomy.ts";
import { parseWeb3CareerApiPayload, web3CareerCanonicalKey } from "./web3-api.ts";

describe("parseLandingSegment", () => {
  it("parses tag, remote-tag, geo, benefit, intern", () => {
    expect(parseLandingSegment("solidity-jobs")).toEqual({
      kind: "tag",
      tag: "solidity",
      tags: ["solidity"],
    });
    expect(parseLandingSegment("remote-jobs")).toEqual({ kind: "remote" });
    expect(parseLandingSegment("remote-solidity-jobs")).toEqual({
      kind: "remote-tag",
      tag: "solidity",
      tags: ["solidity"],
    });
    expect(parseLandingSegment("web3-jobs-new-york")).toEqual({
      kind: "city",
      city: "new-york",
    });
    expect(parseLandingSegment("web3-jobs-united-states")).toEqual({
      kind: "country",
      country: "united-states",
    });
    expect(parseLandingSegment("pay-in-crypto-jobs")).toEqual({
      kind: "benefit",
      benefit: "pay-in-crypto",
    });
    expect(parseLandingSegment("intern-jobs")).toEqual({ kind: "intern" });
    expect(parseLandingSegment("entry-level-jobs")).toEqual({ kind: "entry-level" });
    expect(parseLandingSegment("not-a-real-page")).toBeNull();
  });

  it("parses solana, remote-solana, and featured chip tags", () => {
    expect(parseLandingSegment("solana-jobs")).toEqual({
      kind: "tag",
      tag: "solana",
      tags: ["solana"],
    });
    expect(parseLandingSegment("remote-solana-jobs")).toEqual({
      kind: "remote-tag",
      tag: "solana",
      tags: ["solana"],
    });
    expect(parseLandingSegment("rust-jobs")).toEqual({
      kind: "tag",
      tag: "rust",
      tags: ["rust"],
    });
    expect(parseLandingSegment("discord-jobs")).toEqual({
      kind: "tag",
      tag: "discord",
      tags: ["discord"],
    });
    expect(parseLandingSegment("web3js-jobs")).toEqual({
      kind: "tag",
      tag: "web3js",
      tags: ["web3js"],
    });
    expect(parseLandingSegment("remote-web3js-jobs")).toEqual({
      kind: "remote-tag",
      tag: "web3js",
      tags: ["web3js"],
    });
  });

  it("parses inventory geos that were not in the original city list", () => {
    expect(parseLandingSegment("web3-jobs-paris")).toEqual({ kind: "city", city: "paris" });
    expect(parseLandingSegment("web3-jobs-bangalore")).toEqual({
      kind: "city",
      city: "bangalore",
    });
    expect(parseLandingSegment("web3-jobs-europe")).toEqual({
      kind: "region",
      region: "europe",
    });
  });

  it("treats a combo slug as facets rather than one tag", () => {
    expect(isJobTag("analyst+remote")).toBe(false);
    expect(parseLandingSegment("analyst+remote-jobs")).toEqual({
      kind: "remote-tag",
      tag: "analyst",
      tags: ["analyst"],
    });
  });

  it("rejects combos whose facets are not job tags", () => {
    expect(parseLandingSegment("berlin+solidity-jobs")).toBeNull();
    expect(parseLandingSegment("europe+remote+dev-jobs")).toBeNull();
    expect(parseLandingSegment("not-a-tag+solidity-jobs")).toBeNull();
  });
});

describe("landingHeadline", () => {
  it("returns web3.career-style title case H1s", () => {
    expect(landingHeadline({ kind: "tag", tag: "solana", tags: ["solana"] })).toBe("Solana Jobs");
    expect(landingHeadline({ kind: "remote-tag", tag: "solana", tags: ["solana"] })).toBe(
      "Remote Solana Jobs",
    );
    expect(landingHeadline({ kind: "city", city: "new-york" })).toBe(
      "Web3 Jobs in New York, United States",
    );
    expect(landingHeadline({ kind: "tag", tag: "web3js" , tags: ["web3js"] })).toBe("Web3js Jobs");
  });
});

describe("FEATURED_TAG_CHIPS", () => {
  it("matches the web3.career solana-jobs chip row", () => {
    expect(FEATURED_TAG_CHIPS).toEqual([
      "ai",
      "analyst",
      "backend",
      "bitcoin",
      "blockchain",
      "community-manager",
      "crypto",
      "cryptography",
      "cto",
      "customer-support",
      "dao",
      "data-science",
      "defi",
      "design",
      "developer-relations",
      "devops",
      "discord",
      "economy-designer",
      "entry-level",
      "erc",
      "erc-20",
      "evm",
      "front-end",
      "full-stack",
      "gaming",
      "ganache",
      "golang",
      "hardhat",
      "intern",
      "java",
      "javascript",
      "layer-2",
      "marketing",
      "mobile",
      "moderator",
      "nft",
      "node",
      "non-tech",
      "open-source",
      "openzeppelin",
      "pay-in-crypto",
      "product-manager",
      "project-manager",
      "react",
      "refi",
      "research",
      "ruby",
      "rust",
      "sales",
      "smart-contract",
      "solana",
      "solidity",
      "truffle",
      "web3-py",
      "web3js",
      "zero-knowledge",
    ]);
    expect(isJobTag("discord")).toBe(true);
    expect(isJobTag("web3js")).toBe(true);
    expect(isCitySlug("paris")).toBe(true);
    expect(isCountrySlug("kenya")).toBe(true);
    expect(isRegionSlug("africa")).toBe(true);
  });
});

describe("shouldIndexLanding", () => {
  it("requires at least 5 jobs", () => {
    expect(SEO_MIN_JOBS).toBe(5);
    expect(shouldIndexLanding(1)).toBe(false);
    expect(shouldIndexLanding(4)).toBe(false);
    expect(shouldIndexLanding(5)).toBe(true);
  });
});

describe("landingFaq", () => {
  it("templates unique stats into FAQ copy", () => {
    const faq = landingFaq({ kind: "tag", tag: "solidity", tags: ["solidity"] }, 12, "$100k - $180k");
    expect(faq[0]?.answer).toContain("12");
    expect(faq[1]?.answer).toContain("$100k - $180k");
  });
});

describe("copy factory", () => {
  it("exports unique role blurbs and career FAQ questions", () => {
    const solana = roleWhatTheyDo("solana");
    expect(solana.question).toBe("What does a Solana developer do?");
    expect(solana.answer.toLowerCase()).not.toContain(
      "developers on nodework listings design, ship, and maintain product work that depends on",
    );
    expect(careerFaq().map((item) => item.question)).toContain("How does Web3 work?");
  });
});

describe("parseSalaryPageSlug", () => {
  it("distinguishes role, country, and region", () => {
    expect(parseSalaryPageSlug("solidity-developer")).toEqual({
      kind: "role",
      role: "solidity-developer",
    });
    expect(parseSalaryPageSlug("rust-developer")).toEqual({
      kind: "role",
      role: "rust-developer",
    });
    expect(parseSalaryPageSlug("united-states")).toEqual({
      kind: "country",
      country: "united-states",
    });
    expect(parseSalaryPageSlug("africa")).toEqual({
      kind: "region",
      region: "africa",
    });
    expect(parseSalaryPageSlug("asia")).toEqual({
      kind: "region",
      region: "asia",
    });
    expect(parseSalaryPageSlug("berlin")).toEqual({
      kind: "city",
      city: "berlin",
    });
    expect(parseSalaryPageSlug("senior")).toEqual({
      kind: "seniority",
      seniority: "senior",
    });
    expect(parseSalaryPageSlug("unknown")).toBeNull();
  });

  it("folds the short role aliases onto their canonical long slug", () => {
    expect(parseSalaryPageSlug("solidity")).toEqual({
      kind: "role",
      role: "solidity-developer",
    });
    expect(parseSalaryPageSlug("quantitative")).toEqual({
      kind: "role",
      role: "quantitative-developer",
    });
    // The parser is what the page derives rel=canonical from, so an alias must never
    // round-trip back to itself - that would make two 200 URLs for one page.
    for (const [alias, role] of Object.entries(SALARY_ROLE_ALIASES)) {
      expect(parseSalaryPageSlug(alias)).toEqual({ kind: "role", role });
      expect(alias).not.toBe(role);
    }
  });

  it("decodes nothing itself: route params reach it already decoded by the page", () => {
    expect(parseSalaryPageSlug(" Solidity ")).toEqual({
      kind: "role",
      role: "solidity-developer",
    });
  });
});

describe("SALARY_ROLE_ALIASES", () => {
  it("targets real roles and never shadows another taxonomy slug", () => {
    for (const [alias, role] of Object.entries(SALARY_ROLE_ALIASES)) {
      expect(SALARY_ROLES).toContain(role);
      expect(isSalaryRole(alias)).toBe(false);
      expect(isNonTechSalaryRole(alias)).toBe(false);
      expect(isSenioritySlug(alias)).toBe(false);
      expect(isCountrySlug(alias)).toBe(false);
      expect(isRegionSlug(alias)).toBe(false);
      expect(isCitySlug(alias)).toBe(false);
    }
  });

  it("resolves canonical roles and aliases, and nothing else", () => {
    expect(canonicalSalaryRole("rust-developer")).toBe("rust-developer");
    expect(canonicalSalaryRole("solidity")).toBe("solidity-developer");
    expect(canonicalSalaryRole("marketing")).toBe("marketing");
    expect(canonicalSalaryRole("berlin")).toBeNull();
    expect(canonicalSalaryRole("toString")).toBeNull();
  });
});

describe("parseSalaryBounds", () => {
  it("parses k-suffix ranges", () => {
    expect(parseSalaryBounds("$105k - $180k")).toEqual({ min: 105000, max: 180000 });
  });
});

describe("averageSalary", () => {
  it("ignores rows without both bounds", () => {
    expect(
      averageSalary([
        { min: 100000, max: 200000 },
        { min: null, max: 150000 },
      ]),
    ).toEqual({ min: 100000, max: 200000, avg: 150000 });
  });
});

describe("parseWeb3CareerApiPayload", () => {
  it("maps API jobs to drafts with immutable apply URL and canonical key", () => {
    const drafts = parseWeb3CareerApiPayload([
      {
        id: 153472,
        title: "Solidity Engineer",
        company: "Fiber",
        location: "Remote",
        remote: true,
        salary: "$120k - $180k",
        tags: ["solidity", "smart contract"],
        apply_url: "https://web3.career/solidity-engineer-fiber/153472?utm_source=api",
        description: "Build contracts.",
        published_at: "2026-09-01T00:00:00.000Z",
      },
    ]);

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      source: "web3_career_api",
      title: "Solidity Engineer",
      companyName: "Fiber",
      keepApplyUrl: true,
      externalId: "153472",
      salaryMin: 120000,
      salaryMax: 180000,
      applyUrl: "https://web3.career/solidity-engineer-fiber/153472?utm_source=api",
    });
    expect(web3CareerCanonicalKey("153472")).toBe("web3_career:153472");
    expect(jobSeoSlug("Solidity Engineer", "Fiber")).toBe("solidity-engineer-fiber");
  });

  // What the live API actually sends. The mapper used to read `raw.salary` and
  // `raw.remote`, neither of which exists in the real payload, which is why every
  // imported row landed with a null salary and an "unknown" remote flag.
  it("reads the structured salary pair and is_remote that the live payload carries", () => {
    const drafts = parseWeb3CareerApiPayload([
      {
        id: 153881,
        title: "Payments Engineer",
        company: "Ihsan",
        location: "Remote",
        is_remote: true,
        salary_min_value: "120000.0",
        salary_max_value: "240000.0",
        salary_currency: "USD",
        salary_unit: "YEAR",
        estimated_min_salary: 150000,
        estimated_max_salary: 240000,
        tags: ["backend"],
        apply_url: "https://web3.career/r/wEDNzUTM__nLZtyn",
        description: "Build payments.",
        date: "Sat, 29 Aug 2026 09:35:17 +0100",
      },
    ]);

    expect(drafts[0]).toMatchObject({
      salaryMin: 120000,
      salaryMax: 240000,
      salaryText: "$120k - $240k",
      remote: "remote",
    });
  });

  // The API returns plain-text fields already HTML-escaped. Stored raw, React escapes them
  // a second time and the reader sees a literal "&amp;" on the page. 44 job titles and 4
  // company names were affected; the reference site shows none.
  it("decodes HTML entities in text fields, and leaves the description's HTML alone", () => {
    const [draft] = parseWeb3CareerApiPayload([
      {
        id: 20,
        title: "Full Stack Architect, Digital Assets &amp; Tokenization",
        company: "Smith &amp; Co",
        location: "Z&uuml;rich",
        apply_url: "https://example.com/20",
        description: "<p>Ship &amp; iterate</p>",
      },
    ]);

    expect(draft?.title).toBe("Full Stack Architect, Digital Assets & Tokenization");
    expect(draft?.companyName).toBe("Smith & Co");
    // description is real HTML and must survive untouched, entity and all.
    expect(draft?.descriptionHtml).toContain("&amp;");
  });

  it("normalises the posted date to one comparable ISO shape", () => {
    const [fromEpoch] = parseWeb3CareerApiPayload([
      {
        id: 10,
        title: "A",
        company: "Acme",
        apply_url: "https://example.com/10",
        date: "Sat, 29 Aug 2026 09:35:17 +0100",
        date_epoch: 1787128517,
      },
    ]);
    const [fromRfc] = parseWeb3CareerApiPayload([
      {
        id: 11,
        title: "B",
        company: "Acme",
        apply_url: "https://example.com/11",
        date: "Fri, 13 Jun 2025 09:00:00 GMT",
      },
    ]);

    // SQLite compares these as text, so a mixed column sorts every "Fri, ..." above
    // every "2026-...". Both shapes must land as ISO.
    expect(fromEpoch?.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(fromRfc?.postedAt).toBe("2025-06-13T09:00:00.000Z");
  });

  it("ignores a salary that is not yearly USD rather than converting it", () => {
    const [hourly] = parseWeb3CareerApiPayload([
      {
        id: 1,
        title: "Contractor",
        company: "Acme",
        apply_url: "https://example.com/1",
        salary_min_value: "80",
        salary_max_value: "120",
        salary_currency: "USD",
        salary_unit: "HOUR",
      },
    ]);
    const [euros] = parseWeb3CareerApiPayload([
      {
        id: 2,
        title: "Engineer",
        company: "Acme",
        apply_url: "https://example.com/2",
        salary_min_value: "90000",
        salary_max_value: "120000",
        salary_currency: "EUR",
        salary_unit: "YEAR",
      },
    ]);

    expect(hourly).toMatchObject({ salaryMin: null, salaryMax: null });
    expect(euros).toMatchObject({ salaryMin: null, salaryMax: null });
  });

  // `estimated_*` are the upstream provider's own guesses for listings that state no pay.
  // Importing them would republish someone else's derived figures as our salary data.
  it("never imports the upstream provider's estimated salary fields", () => {
    const [draft] = parseWeb3CareerApiPayload([
      {
        id: 3,
        title: "Analyst",
        company: "Acme",
        apply_url: "https://example.com/3",
        estimated_min_salary: 150000,
        estimated_max_salary: 240000,
        estimated_avg_salary: 180000,
      },
    ]);

    expect(draft).toMatchObject({ salaryMin: null, salaryMax: null, salaryText: null });
  });

  it("locates jobs inside the mixed-type root array the API returns", () => {
    const drafts = parseWeb3CareerApiPayload([
      "ok",
      "extra",
      [
        {
          id: "9",
          title: "Rust Engineer",
          company: "Labs",
          apply_url: "https://web3.career/rust-engineer-labs/9?utm_source=api",
        },
      ],
    ]);

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.externalId).toBe("9");
  });
});
