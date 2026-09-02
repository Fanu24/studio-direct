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

  it("returns null when SITE_URL is missing, blank, or not an absolute URL", () => {
    expect(resolveRobotsSitemap(undefined)).toBeNull();
    expect(resolveRobotsSitemap(null)).toBeNull();
    expect(resolveRobotsSitemap("")).toBeNull();
    expect(resolveRobotsSitemap("   ")).toBeNull();
    expect(resolveRobotsSitemap("jobs.example.com")).toBeNull();
    expect(resolveRobotsSitemap("/sitemap.xml")).toBeNull();
    expect(resolveRobotsSitemap("not a url")).toBeNull();
  });

  it("returns null for non-http schemes and the reserved example origin", () => {
    expect(resolveRobotsSitemap("ftp://jobs.example.com")).toBeNull();
    expect(resolveRobotsSitemap("mailto:hello@example.com")).toBeNull();
    expect(resolveRobotsSitemap("https://studio-direct.example")).toBeNull();
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

  it("omits the sitemap key entirely when SITE_URL is unusable", () => {
    expect(buildRobots(undefined)).not.toHaveProperty("sitemap");
    expect(buildRobots("not a url")).not.toHaveProperty("sitemap");
    expect(buildRobots("https://studio-direct.example")).not.toHaveProperty("sitemap");
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

  it("still serves rules without a sitemap when SITE_URL is unset", () => {
    vi.stubEnv("SITE_URL", "");
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

    expect(result).not.toHaveProperty("sitemap");
    expect(rules[0]?.disallow).toContain("/api/");
  });
});
