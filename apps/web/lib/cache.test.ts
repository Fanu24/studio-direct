import { describe, expect, it } from "vitest";

import {
  PRIVATE_CACHE_CONTROL,
  cacheControlForRequest,
  isPublicRevalidatedPath,
} from "./cache";

describe("cacheControlForRequest", () => {
  it("allows shared caching only for revalidated requests without cookies", () => {
    expect(cacheControlForRequest({ revalidate: 300, hasCookies: false })).toBe(
      "public, s-maxage=300",
    );
    expect(cacheControlForRequest({ revalidate: undefined, hasCookies: false })).toBe(
      PRIVATE_CACHE_CONTROL,
    );
    expect(cacheControlForRequest({ revalidate: 300, hasCookies: true })).toBe(
      PRIVATE_CACHE_CONTROL,
    );
  });

  it("recognizes only public catalog routes as revalidated pages", () => {
    expect(isPublicRevalidatedPath("/hidden-jobs")).toBe(true);
    expect(isPublicRevalidatedPath("/roles")).toBe(true);
    expect(isPublicRevalidatedPath("/about")).toBe(true);
    expect(isPublicRevalidatedPath("/web3-salaries")).toBe(true);
    expect(isPublicRevalidatedPath("/solidity-jobs")).toBe(true);
    expect(isPublicRevalidatedPath("/web3-jobs-new-york")).toBe(true);
    expect(isPublicRevalidatedPath("/dashboard")).toBe(false);
    expect(isPublicRevalidatedPath("/jobs/gameplay-engineer")).toBe(true);
    expect(isPublicRevalidatedPath("/profile")).toBe(false);
    expect(isPublicRevalidatedPath("/settings")).toBe(false);
    expect(isPublicRevalidatedPath("/login")).toBe(false);
    expect(isPublicRevalidatedPath("/onboarding")).toBe(false);
    expect(isPublicRevalidatedPath("/talent/candidate")).toBe(false);
  });

  it("covers the canonical /web3-companies directory shapes", () => {
    expect(isPublicRevalidatedPath("/web3-companies")).toBe(true);
    expect(isPublicRevalidatedPath("/web3-companies/alpha-studio")).toBe(true);
    expect(isPublicRevalidatedPath("/web3-companies/top-growing")).toBe(true);
    expect(isPublicRevalidatedPath("/web3-companies/tag/solidity")).toBe(true);
    // One level deeper than any real company route: not a page, not cached.
    expect(isPublicRevalidatedPath("/web3-companies/tag/solidity/extra")).toBe(false);
  });

  it("keeps the legacy /companies redirects publicly cacheable", () => {
    expect(isPublicRevalidatedPath("/companies")).toBe(true);
    expect(isPublicRevalidatedPath("/companies/alpha-studio")).toBe(true);
  });

  it("covers the other canonical taxonomy hubs and their detail pages", () => {
    expect(isPublicRevalidatedPath("/web3-non-tech-salaries")).toBe(true);
    expect(isPublicRevalidatedPath("/web3-non-tech-salaries/marketing")).toBe(true);
    expect(isPublicRevalidatedPath("/web3-cities")).toBe(true);
    // /web3-cities has no detail route of its own; city pages are /web3-jobs-:city.
    expect(isPublicRevalidatedPath("/web3-cities/berlin")).toBe(false);
    expect(isPublicRevalidatedPath("/learn-web3")).toBe(true);
    expect(isPublicRevalidatedPath("/learn-web3/course")).toBe(true);
  });
});
