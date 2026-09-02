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
    expect(isPublicRevalidatedPath("/jobs/gameplay-engineer")).toBe(true);
    expect(isPublicRevalidatedPath("/profile")).toBe(false);
    expect(isPublicRevalidatedPath("/login")).toBe(false);
    expect(isPublicRevalidatedPath("/talent/candidate")).toBe(false);
  });
});
