import { describe, expect, it } from "vitest";

import {
  landingFaq,
  landingHeadline,
  landingPath,
  landingTitle,
  parseLandingSegment,
  relatedLandings,
} from "./landings.ts";

describe("parseLandingSegment: multi-facet combos", () => {
  it("parses two-tag combos regardless of input order and dedupes+sorts the facet list", () => {
    expect(parseLandingSegment("dev+remote-jobs")).toEqual({
      kind: "remote-tag",
      tag: "dev",
      tags: ["dev"],
    });
    expect(parseLandingSegment("remote+solidity-jobs")).toEqual({
      kind: "remote-tag",
      tag: "solidity",
      tags: ["solidity"],
    });
    expect(parseLandingSegment("junior+dev+remote-jobs")).toEqual({
      kind: "remote-tag",
      tag: "dev",
      tags: ["dev", "junior"],
    });
    // Same facets, different input order -> identical parsed shape.
    expect(parseLandingSegment("dev+junior+remote-jobs")).toEqual(
      parseLandingSegment("junior+dev+remote-jobs"),
    );
  });

  it("parses a non-remote multi-tag combo as kind tag with the sorted facet list", () => {
    expect(parseLandingSegment("junior+dev-jobs")).toEqual({
      kind: "tag",
      tag: "dev",
      tags: ["dev", "junior"],
    });
  });

  it("rejects geo facets combined with a tag or remote", () => {
    expect(parseLandingSegment("berlin+solidity-jobs")).toBeNull();
    expect(parseLandingSegment("europe+remote+dev-jobs")).toBeNull();
    expect(parseLandingSegment("united-states+solidity-jobs")).toBeNull();
  });

  it("rejects a combo where any part is not a known job tag", () => {
    expect(parseLandingSegment("not-a-real-tag+remote-jobs")).toBeNull();
  });

  it("dedupes remote+remote down to the plain remote landing", () => {
    expect(parseLandingSegment("remote+remote-jobs")).toEqual({ kind: "remote" });
  });

  it("still parses ordinary single-tag and single remote-tag slugs, with a singleton tags array", () => {
    expect(parseLandingSegment("solidity-jobs")).toEqual({
      kind: "tag",
      tag: "solidity",
      tags: ["solidity"],
    });
    expect(parseLandingSegment("remote-jobs")).toEqual({ kind: "remote" });
  });

  it("keeps the legacy /remote-<tag>-jobs alias parsing, with a singleton tags array", () => {
    expect(parseLandingSegment("remote-solidity-jobs")).toEqual({
      kind: "remote-tag",
      tag: "solidity",
      tags: ["solidity"],
    });
  });
});

describe("landingPath: canonical + form", () => {
  it("keeps single-tag paths in the plain form", () => {
    expect(landingPath({ kind: "tag", tag: "solidity", tags: ["solidity"] })).toBe(
      "/solidity-jobs",
    );
  });

  it("emits the sorted + join for multi-tag combos", () => {
    expect(
      landingPath({ kind: "tag", tag: "dev", tags: ["dev", "junior"] }),
    ).toBe("/dev+junior-jobs");
  });

  it("emits the sorted + form (including remote) for every remote-tag case, even a single tag", () => {
    expect(
      landingPath({ kind: "remote-tag", tag: "solidity", tags: ["solidity"] }),
    ).toBe("/remote+solidity-jobs");
    expect(
      landingPath({ kind: "remote-tag", tag: "dev", tags: ["dev", "junior"] }),
    ).toBe("/dev+junior+remote-jobs");
  });

  it("canonicalises the legacy remote-<tag>-jobs alias to the + form", () => {
    const parsed = parseLandingSegment("remote-solidity-jobs");
    expect(parsed).not.toBeNull();
    expect(landingPath(parsed!)).toBe("/remote+solidity-jobs");
  });

  it("round-trips a parsed multi-tag remote combo back to its own canonical path", () => {
    const parsed = parseLandingSegment("junior+dev+remote-jobs");
    expect(parsed).not.toBeNull();
    expect(landingPath(parsed!)).toBe("/dev+junior+remote-jobs");
  });
});

describe("landingHeadline: word order and in Web3 matrix", () => {
  it("keeps a lone specific tag with no in Web3 suffix", () => {
    expect(landingHeadline({ kind: "tag", tag: "solidity", tags: ["solidity"] })).toBe(
      "Solidity Jobs",
    );
    expect(
      landingHeadline({ kind: "remote-tag", tag: "solidity", tags: ["solidity"] }),
    ).toBe("Remote Solidity Jobs");
  });

  it("appends in Web3 for a lone generic role tag, remote or not", () => {
    expect(landingHeadline({ kind: "tag", tag: "marketing", tags: ["marketing"] })).toBe(
      "Marketing Jobs in Web3",
    );
    expect(
      landingHeadline({ kind: "remote-tag", tag: "marketing", tags: ["marketing"] }),
    ).toBe("Remote Marketing Jobs in Web3");
  });

  it("orders [Remote] [Seniority] [Coarse] [Specific] Jobs, lowest seniority only", () => {
    expect(
      landingHeadline({
        kind: "remote-tag",
        tag: "dev",
        tags: ["dev", "junior"],
      }),
    ).toBe("Remote Junior Dev Jobs in Web3");

    expect(
      landingHeadline({
        kind: "tag",
        tag: "junior",
        tags: ["cto", "junior"],
      }),
    ).toBe("Junior Jobs in Web3");

    expect(
      landingHeadline({
        kind: "tag",
        tag: "junior",
        tags: ["junior", "solidity"],
      }),
    ).toBe("Junior Solidity Jobs");
  });

  it("appends in Web3 when no SPECIFIC tag survives (seniority/coarse only), never when one does", () => {
    expect(landingHeadline({ kind: "remote-tag", tag: "dev", tags: ["dev"] })).toBe(
      "Remote Dev Jobs in Web3",
    );
    expect(
      landingHeadline({ kind: "tag", tag: "dev", tags: ["dev", "solidity"] }),
    ).toBe("Dev Solidity Jobs");
  });
});

describe("landingTitle: same word order, lowercase jobs", () => {
  it("mirrors the headline shape with a lowercase jobs word", () => {
    expect(landingTitle({ kind: "tag", tag: "solidity", tags: ["solidity"] })).toBe(
      "Solidity jobs",
    );
    expect(landingTitle({ kind: "tag", tag: "marketing", tags: ["marketing"] })).toBe(
      "Marketing jobs in Web3",
    );
    expect(
      landingTitle({ kind: "remote-tag", tag: "solidity", tags: ["solidity"] }),
    ).toBe("Remote Solidity jobs");
  });
});

describe("city/country headline and title", () => {
  it("appends the country for a mapped city", () => {
    expect(landingHeadline({ kind: "city", city: "new-york" })).toBe(
      "Web3 Jobs in New York, United States",
    );
    expect(landingTitle({ kind: "city", city: "new-york" })).toBe(
      "Web3 jobs in New York, United States",
    );
  });

  it("falls back to the bare city name when there is no CITY_COUNTRY entry", () => {
    expect(landingHeadline({ kind: "city", city: "aba" })).toBe("Web3 Jobs in Aba");
    expect(landingTitle({ kind: "city", city: "aba" })).toBe("Web3 jobs in Aba");
  });

  it("does not touch country/region headlines, which have no city suffix concept", () => {
    expect(landingHeadline({ kind: "country", country: "united-states" })).toBe(
      "Web3 Jobs in United States",
    );
    expect(landingHeadline({ kind: "region", region: "europe" })).toBe(
      "Web3 Jobs in Europe",
    );
  });
});

describe("benefit headline shape", () => {
  it("leads with the entity and expresses the benefit as a qualifier", () => {
    expect(landingHeadline({ kind: "benefit", benefit: "401k" })).toBe(
      "Web3 Jobs with 401k",
    );
    expect(landingHeadline({ kind: "benefit", benefit: "pto" })).toBe(
      "Web3 Jobs with PTO",
    );
  });

  it("special-cases pay-in-crypto to natural phrasing instead of Web3 Jobs with Pay In Crypto", () => {
    expect(landingHeadline({ kind: "benefit", benefit: "pay-in-crypto" })).toBe(
      "Web3 Jobs That Pay in Crypto",
    );
  });

  it("is structurally distinct from a tag landing headline for the same slug", () => {
    const benefitHeadline = landingHeadline({ kind: "benefit", benefit: "pto" });
    const tagHeadline = landingHeadline({ kind: "tag", tag: "pto", tags: ["pto"] });
    expect(benefitHeadline).not.toBe(tagHeadline);
    expect(benefitHeadline).toBe("Web3 Jobs with PTO");
    expect(tagHeadline).toBe("PTO Jobs");
  });
});

describe("relatedLandings", () => {
  it("derives the real region for a city instead of hardcoding europe, and adds the city's own country", () => {
    const related = relatedLandings({ kind: "city", city: "new-york" });
    expect(related).toContainEqual({ kind: "country", country: "united-states" });
    expect(related).toContainEqual({ kind: "region", region: "north-america" });
    expect(related).not.toContainEqual({ kind: "region", region: "europe" });
  });

  it("derives the real region for a country", () => {
    const related = relatedLandings({ kind: "country", country: "japan" });
    expect(related).toContainEqual({ kind: "region", region: "asia" });
    expect(related).not.toContainEqual({ kind: "region", region: "europe" });
  });

  it("skips the country/region push for an unmapped city rather than guessing", () => {
    const related = relatedLandings({ kind: "city", city: "aba" });
    expect(related.some((item) => item.kind === "country")).toBe(false);
  });

  it("adds a single-facet drill-through for every tag in a multi-tag combo", () => {
    const related = relatedLandings({
      kind: "remote-tag",
      tag: "dev",
      tags: ["dev", "junior"],
    });
    expect(related).toContainEqual({ kind: "tag", tag: "dev", tags: ["dev"] });
    expect(related).toContainEqual({ kind: "tag", tag: "junior", tags: ["junior"] });
  });

  it("keeps the single-tag remote<->tag swap for a lone facet", () => {
    const related = relatedLandings({ kind: "tag", tag: "solidity", tags: ["solidity"] });
    expect(related).toContainEqual({
      kind: "remote-tag",
      tag: "solidity",
      tags: ["solidity"],
    });
  });

  it("stays capped at 8", () => {
    const related = relatedLandings({ kind: "city", city: "new-york" });
    expect(related.length).toBeLessThanOrEqual(8);
  });
});

describe("landingFaq: Title-Cased place and tag names", () => {
  it("keeps the place name capitalized instead of lowercasing the whole title", () => {
    const faq = landingFaq({ kind: "city", city: "berlin" }, 12, null);
    expect(faq[0]?.question).toBe("How many Web3 jobs are listed in Berlin?");
    expect(faq[0]?.answer).toContain("Berlin");
  });

  it("keeps a tag name capitalized in the question", () => {
    const faq = landingFaq({ kind: "tag", tag: "solidity", tags: ["solidity"] }, 12, "$100k - $180k");
    expect(faq[0]?.question).toBe("How many Solidity jobs are listed?");
    expect(faq[0]?.answer).toContain("12");
    expect(faq[1]?.answer).toContain("$100k - $180k");
  });

  it("still interpolates the live job count in the answer", () => {
    const single = landingFaq({ kind: "tag", tag: "solidity", tags: ["solidity"] }, 1, null);
    expect(single[0]?.answer).toContain("1 listing");
  });
});

describe("decoded path segments", () => {
  it("parses a combo whose + was decoded to a space by the router", () => {
    // Next.js decodes the path segment before handing it to the page, and "+"
    // decodes to " ". Both forms must resolve to the same landing.
    expect(parseLandingSegment("remote solidity-jobs")).toEqual(
      parseLandingSegment("remote+solidity-jobs"),
    );
    expect(parseLandingSegment("junior dev remote-jobs")).toEqual(
      parseLandingSegment("junior+dev+remote-jobs"),
    );
    expect(parseLandingSegment("remote solidity-jobs")).not.toBeNull();
  });
});
