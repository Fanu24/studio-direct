import { afterEach, describe, expect, it, vi } from "vitest";

import robots, { PRIVATE_PATHS, buildRobots, resolveRobotsSitemap } from "./robots";

describe("resolveRobotsSitemap", () => {
  it("points at /sitemap.xml on the SITE_URL origin", () => {
    expect(resolveRobotsSitemap("https://jobs.example.com")).toBe(
      "https://jobs.example.com/sitemap.xml",
    );
  });

  it("drops any path, query, or trailing slash from SITE_URL", () => {
    expect(resolveRobotsSitemap("https://jobs.example.com/some/path?x=1")).toBe(
      "https://jobs.example.com/sitemap.xml",
    );
    expect(resolveRobotsSitemap("  https://jobs.example.com/  ")).toBe(
      "https://jobs.example.com/sitemap.xml",
    );
  });

  it("falls back to a relative /sitemap.xml when SITE_URL is missing, blank, or not an absolute URL", () => {
    expect(resolveRobotsSitemap(undefined)).toBe("/sitemap.xml");
    expect(resolveRobotsSitemap(null)).toBe("/sitemap.xml");
    expect(resolveRobotsSitemap("")).toBe("/sitemap.xml");
    expect(resolveRobotsSitemap("   ")).toBe("/sitemap.xml");
    expect(resolveRobotsSitemap("jobs.example.com")).toBe("/sitemap.xml");
    expect(resolveRobotsSitemap("/sitemap.xml")).toBe("/sitemap.xml");
    expect(resolveRobotsSitemap("not a url")).toBe("/sitemap.xml");
  });

  it("falls back to a relative /sitemap.xml for non-http schemes and the reserved example origin", () => {
    expect(resolveRobotsSitemap("ftp://jobs.example.com")).toBe("/sitemap.xml");
    expect(resolveRobotsSitemap("mailto:hello@example.com")).toBe("/sitemap.xml");
    expect(resolveRobotsSitemap("https://studio-direct.example")).toBe("/sitemap.xml");
  });
});

describe("buildRobots", () => {
  it("allows everything except the API and account routes", () => {
    const result = buildRobots("https://jobs.example.com");
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

    expect(rules).toHaveLength(1);
    expect(rules[0]?.userAgent).toBe("*");
    expect(rules[0]?.allow).toBe("/");
    expect(rules[0]?.disallow).toEqual([
      "/api/",
      "/dashboard",
      "/profile",
      "/settings",
      "/onboarding",
    ]);
    expect(rules[0]?.disallow).toEqual([...PRIVATE_PATHS]);
    expect(result.sitemap).toBe("https://jobs.example.com/sitemap.xml");
  });

  it("still emits a Sitemap line pointing at the relative fallback when SITE_URL is unusable", () => {
    expect(buildRobots(undefined).sitemap).toBe("/sitemap.xml");
    expect(buildRobots("not a url").sitemap).toBe("/sitemap.xml");
    expect(buildRobots("https://studio-direct.example").sitemap).toBe("/sitemap.xml");
  });
});

describe("robots route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads SITE_URL from the environment", () => {
    vi.stubEnv("SITE_URL", "https://jobs.example.com");
    expect(robots().sitemap).toBe("https://jobs.example.com/sitemap.xml");
  });

  it("still serves a Sitemap line when SITE_URL is unset", () => {
    vi.stubEnv("SITE_URL", "");
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

    expect(result.sitemap).toBe("/sitemap.xml");
    expect(rules[0]?.disallow).toContain("/api/");
  });
});
