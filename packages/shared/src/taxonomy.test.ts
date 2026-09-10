import { describe, expect, it } from "vitest";
import {
  BENEFITS,
  CITIES,
  CITY_COUNTRY,
  COUNTRIES,
  COUNTRY_REGION,
  REGIONS,
  citiesInCountry,
  countriesInRegion,
  countryForCity,
  isBenefitSlug,
  isNonTechSalaryRole,
  regionForCity,
  regionForCountry,
  tagLabel,
} from "./taxonomy.ts";

describe("BENEFITS", () => {
  it("has exactly 21 entries", () => {
    expect(BENEFITS.length).toBe(21);
  });

  it("contains 401k, fsa and hsa", () => {
    expect(BENEFITS).toContain("401k");
    expect(BENEFITS).toContain("fsa");
    expect(BENEFITS).toContain("hsa");
  });

  it("does not contain the old 401k-plan slug", () => {
    expect(BENEFITS).not.toContain("401k-plan");
  });

  it("guards benefit slugs with isBenefitSlug", () => {
    expect(isBenefitSlug("401k")).toBe(true);
    expect(isBenefitSlug("401k-plan")).toBe(false);
  });
});

describe("tagLabel overrides", () => {
  it("labels PTO, FSA, HSA and 401k correctly", () => {
    expect(tagLabel("pto")).toBe("PTO");
    expect(tagLabel("fsa")).toBe("FSA");
    expect(tagLabel("hsa")).toBe("HSA");
    expect(tagLabel("401k")).toBe("401k");
  });

  it("labels multi-word benefit slugs in title case", () => {
    expect(tagLabel("4-day-work-week")).toBe("4 Day Work Week");
    expect(tagLabel("pay-in-crypto")).toBe("Pay In Crypto");
  });
});

describe("isNonTechSalaryRole", () => {
  it("accepts non-tech role slugs", () => {
    expect(isNonTechSalaryRole("legal")).toBe(true);
    expect(isNonTechSalaryRole("hr")).toBe(true);
    expect(isNonTechSalaryRole("community-manager")).toBe(true);
    expect(isNonTechSalaryRole("project-manager")).toBe(true);
    expect(isNonTechSalaryRole("social-media")).toBe(true);
  });

  it("rejects tech developer role slugs", () => {
    expect(isNonTechSalaryRole("react-developer")).toBe(false);
    expect(isNonTechSalaryRole("solidity-developer")).toBe(false);
  });
});

describe("CITY_COUNTRY", () => {
  it("only maps cities that exist in CITIES", () => {
    const citySet = new Set<string>(CITIES);
    for (const city of Object.keys(CITY_COUNTRY)) {
      expect(citySet.has(city)).toBe(true);
    }
  });

  it("only maps to countries that exist in COUNTRIES", () => {
    const countrySet = new Set<string>(COUNTRIES);
    for (const country of Object.values(CITY_COUNTRY)) {
      expect(countrySet.has(country as string)).toBe(true);
    }
  });

  it("covers every major hub city referenced in site navigation", () => {
    for (const city of [
      "amsterdam",
      "berlin",
      "london",
      "new-york",
      "san-francisco",
      "singapore",
      "dubai",
      "tokyo",
      "toronto",
    ]) {
      expect(CITY_COUNTRY[city as keyof typeof CITY_COUNTRY]).toBeDefined();
    }
  });
});

describe("COUNTRY_REGION", () => {
  it("has a key for every country and a value in REGIONS", () => {
    const regionSet = new Set<string>(REGIONS);
    for (const country of COUNTRIES) {
      expect(COUNTRY_REGION[country]).toBeDefined();
      expect(regionSet.has(COUNTRY_REGION[country])).toBe(true);
    }
  });

  it("covers all 87 countries", () => {
    expect(Object.keys(COUNTRY_REGION).length).toBe(COUNTRIES.length);
    expect(COUNTRIES.length).toBe(87);
  });
});

describe("region helpers", () => {
  it("regionForCity round-trips through countryForCity and regionForCountry", () => {
    for (const city of Object.keys(CITY_COUNTRY) as (keyof typeof CITY_COUNTRY)[]) {
      const country = countryForCity(city);
      expect(country).toBeDefined();
      const region = regionForCity(city);
      expect(region).toBe(regionForCountry(country!));
    }
  });

  it("citiesInCountry lists cities that map back to that country", () => {
    for (const city of citiesInCountry("united-states")) {
      expect(countryForCity(city)).toBe("united-states");
    }
    expect(citiesInCountry("united-states").length).toBeGreaterThan(0);
  });

  it("countriesInRegion lists countries that map back to that region", () => {
    for (const country of countriesInRegion("europe")) {
      expect(regionForCountry(country)).toBe("europe");
    }
    expect(countriesInRegion("europe").length).toBeGreaterThan(0);
  });

  it("returns undefined for a city with no mapping", () => {
    expect(regionForCity("zunyi")).toBeUndefined();
    expect(countryForCity("zunyi")).toBeUndefined();
  });
});
