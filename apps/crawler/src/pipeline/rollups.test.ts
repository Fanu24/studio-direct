import { describe, expect, it } from "vitest";

import { buildSalaryRollup } from "@gaming/shared";

import {
  buildRollupRow,
  citiesWithJobs,
  companiesWithJobs,
  locationMatchesSlug,
  matchesRole,
  salaryRoleStem,
} from "./rollups";

describe("buildSalaryRollup", () => {
  it("skips empty salary sets", () => {
    expect(buildSalaryRollup("role", "solidity-developer", [{ min: null, max: null }])).toBeNull();
  });

  it("averages midpoints", () => {
    expect(
      buildSalaryRollup("role", "solidity-developer", [
        { min: 100000, max: 200000 },
        { min: 80000, max: 120000 },
      ]),
    ).toEqual({
      dimension: "role",
      slug: "solidity-developer",
      avg: 125000,
      min: 80000,
      max: 200000,
      jobCount30d: 2,
    });
  });
});

describe("salary role matching", () => {
  it("maps solidity-developer to the solidity stem", () => {
    expect(salaryRoleStem("solidity-developer")).toBe("solidity");
    expect(salaryRoleStem("product-manager")).toBe("product-manager");
  });

  it("matches a role from tags or title", () => {
    expect(matchesRole("Engineer", "solidity rust", "solidity-developer")).toBe(true);
    expect(matchesRole("Product Manager", "product-manager", "product-manager")).toBe(true);
    expect(matchesRole("Solidity Engineer", null, "solidity-developer")).toBe(true);
    expect(matchesRole("Rust Engineer", "rust", "solidity-developer")).toBe(false);
  });
});

describe("locationMatchesSlug", () => {
  it("matches country slugs from job_locations without scanning cities", () => {
    expect(locationMatchesSlug("Berlin", "germany berlin", "germany")).toBe(true);
    expect(locationMatchesSlug("Remote", "united-states", "united-states")).toBe(true);
    expect(locationMatchesSlug("United States", null, "united-states")).toBe(true);
    expect(locationMatchesSlug("London", "united-kingdom london", "germany")).toBe(false);
  });
});

describe("buildRollupRow", () => {
  it("emits a city dimension row", () => {
    expect(
      buildRollupRow("city", "berlin", [
        { min: 80000, max: 120000 },
        { min: 90000, max: 130000 },
      ]),
    ).toEqual({
      dimension: "city",
      slug: "berlin",
      avg: 105000,
      min: 80000,
      max: 130000,
      jobCount30d: 2,
    });
  });

  it("emits a company dimension row", () => {
    expect(buildRollupRow("company", "riot-games", [{ min: 140000, max: 190000 }])).toEqual({
      dimension: "company",
      slug: "riot-games",
      avg: 165000,
      min: 140000,
      max: 190000,
      jobCount30d: 1,
    });
  });

  it("skips an empty salary set for any dimension", () => {
    expect(buildRollupRow("city", "berlin", [{ min: null, max: null }])).toBeNull();
    expect(buildRollupRow("company", "riot-games", [])).toBeNull();
  });
});

describe("citiesWithJobs", () => {
  it("collects distinct city slugs found in the job_locations aggregate, ignoring country/region tokens", () => {
    const rows = [
      { min: 1, max: 2, title: "", location: null, tags: null, locations: "berlin germany europe", companyNameNorm: null },
      { min: 1, max: 2, title: "", location: null, tags: null, locations: "berlin germany europe", companyNameNorm: null },
      { min: 1, max: 2, title: "", location: null, tags: null, locations: "lisbon portugal europe", companyNameNorm: null },
      { min: 1, max: 2, title: "", location: null, tags: null, locations: null, companyNameNorm: null },
    ];
    expect(citiesWithJobs(rows).sort()).toEqual(["berlin", "lisbon"]);
  });
});

describe("companiesWithJobs", () => {
  it("collects distinct company name_norm values, ignoring rows with no company", () => {
    const rows = [
      { min: 1, max: 2, title: "", location: null, tags: null, locations: null, companyNameNorm: "riot" },
      { min: 1, max: 2, title: "", location: null, tags: null, locations: null, companyNameNorm: "riot" },
      { min: 1, max: 2, title: "", location: null, tags: null, locations: null, companyNameNorm: "roblox" },
      { min: 1, max: 2, title: "", location: null, tags: null, locations: null, companyNameNorm: null },
    ];
    expect(companiesWithJobs(rows).sort()).toEqual(["riot", "roblox"]);
  });
});
