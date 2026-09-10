import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEARN_CATEGORIES } from "./learn-web3/categories";

const EXCLUDED_EXACT = [
  "/user",
  "/users",
  "/profile",
  "/login",
  "/onboarding",
  "/settings",
  "/talent",
  "/hidden-jobs",
] as const;

function isExcludedSitemapPath(path: string) {
  return (
    path.startsWith("/@") ||
    path === "/user" ||
    path.startsWith("/user/") ||
    path === "/users" ||
    path.startsWith("/users/") ||
    path === "/talent" ||
    path.startsWith("/talent/") ||
    EXCLUDED_EXACT.includes(path as (typeof EXCLUDED_EXACT)[number])
  );
}

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listSitemapEntries: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../lib/jobs/queries", async () => {
  const actual = await vi.importActual<typeof import("../lib/jobs/queries")>(
    "../lib/jobs/queries",
  );
  return {
    ...actual,
    listSitemapEntries: mocks.listSitemapEntries,
  };
});

function stubEntries() {
  mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
  mocks.listSitemapEntries.mockResolvedValue(emptyEntries());
}

describe("sitemap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("SITE_URL", "https://jobs.example.com");
    stubEntries();
  });

  it("exposes a sitemap index of typed child sitemaps", async () => {
    const { default: sitemap, SITEMAP_INDEX_PATHS } = await import("./sitemap");
    const entries = await sitemap();
    const paths = entries.map(({ url }) => new URL(url).pathname);

    expect(paths).toEqual([...SITEMAP_INDEX_PATHS]);
    expect(paths).toEqual([
      "/sitemaps/static.xml",
      "/sitemaps/jobs.xml",
      "/sitemaps/tags.xml",
      "/sitemaps/geo.xml",
      "/sitemaps/salaries.xml",
      "/sitemaps/companies.xml",
      "/sitemaps/hire.xml",
      "/sitemaps/learn.xml",
    ]);
    for (const path of paths) {
      expect(isExcludedSitemapPath(path)).toBe(false);
    }
    expect(paths).not.toContain("/hidden-jobs");
    expect(paths).not.toContain("/profile");
    expect(paths).not.toContain("/settings");
    expect(paths).not.toContain("/login");
    expect(paths).not.toContain("/onboarding");
    expect(paths.some((path) => path === "/talent" || path.startsWith("/talent/"))).toBe(false);
    expect(paths.some((path) => path.startsWith("/@"))).toBe(false);
  });

  it("lists intern, hire, learn, and ranking hubs on the static child sitemap", async () => {
    const { STATIC_PATHS, sitemapPathsForKind } = await import("./sitemap");

    expect(STATIC_PATHS).toContain("/intern-jobs");
    expect(STATIC_PATHS).toContain("/entry-level-jobs");
    expect(STATIC_PATHS).toContain("/entry-developer-jobs");
    expect(STATIC_PATHS).toContain("/entry-non-tech-jobs");
    expect(STATIC_PATHS).toContain("/entry-designer-jobs");
    expect(STATIC_PATHS).toContain("/top-web3-internships");
    expect(STATIC_PATHS).toContain("/hire");
    expect(STATIC_PATHS).toContain("/learn-web3");
    expect(STATIC_PATHS).toContain("/roles");
    expect(STATIC_PATHS).toContain("/highest-paying-web3-jobs");
    expect(STATIC_PATHS).toContain("/highest-paid-developer-jobs");
    expect(STATIC_PATHS).toContain("/highest-paid-non-tech-jobs");
    expect(STATIC_PATHS).toContain("/highest-paid-designers-jobs");
    expect(STATIC_PATHS).toContain("/top-web3-jobs");
    expect(STATIC_PATHS).toContain("/most-popular-developer-jobs");
    expect(STATIC_PATHS).toContain("/most-popular-non-tech-jobs");
    expect(STATIC_PATHS).toContain("/most-popular-designers-jobs");
    expect(STATIC_PATHS).toContain("/web3-companies/top-growing");
    expect(STATIC_PATHS).toContain("/web3-salaries/solana-vs-ethereum");
    expect(STATIC_PATHS).toContain("/web3-cities");
    expect(STATIC_PATHS).toContain("/web3-non-tech-salaries");
    expect(STATIC_PATHS).toContain("/faq");
    expect(STATIC_PATHS).toContain("/what-is-web3");
    expect(sitemapPathsForKind("static", emptyEntries())).toEqual([...STATIC_PATHS]);
    expect(STATIC_PATHS.every((path) => !isExcludedSitemapPath(path))).toBe(true);
  });

  it("lists the canonical /web3-companies and never the /companies paths that 308-redirect to it", async () => {
    const { STATIC_PATHS, sitemapPathsForKind } = await import("./sitemap");

    expect(STATIC_PATHS).toContain("/web3-companies");
    expect(STATIC_PATHS).not.toContain("/companies");
    expect(STATIC_PATHS).not.toContain("/top-growing-web3-companies");
    expect(sitemapPathsForKind("static", emptyEntries())).not.toContain("/companies");
    expect(
      sitemapPathsForKind("companies", { ...emptyEntries(), companySlugs: ["alpha"] }),
    ).toEqual(["/web3-companies/alpha"]);
  });

  it("never lists a ranking path that 308-redirects to another spelling", async () => {
    const { STATIC_PATHS } = await import("./sitemap");

    // Every one of these is a permanentRedirect stub kept for old inbound links.
    // A sitemap entry pointing at a redirect wastes crawl budget on every recrawl.
    for (const redirectSource of [
      "/companies",
      "/hidden-jobs",
      "/highest-paid-developers-jobs",
      "/most-popular-designer-jobs",
      "/top-growing-web3-companies",
    ]) {
      expect(STATIC_PATHS).not.toContain(redirectSource);
    }
    expect(STATIC_PATHS).toContain("/highest-paid-developer-jobs");
    expect(STATIC_PATHS).toContain("/most-popular-designers-jobs");
  });

  it("never puts user, talent, login, or profile URLs in any child sitemap", async () => {
    const { SITEMAP_INDEX_PATHS, STATIC_PATHS, sitemapPathsForKind } = await import(
      "./sitemap"
    );
    const entries = {
      jobs: [{ slug: "solidity-dev-acme", externalId: "42" }],
      companySlugs: ["acme"],
      tagSlugs: ["solidity", "intern", "entry-level"],
      geoSlugs: ["berlin"],
      salarySlugs: ["solidity-developer"],
      benefitSlugs: ["pay-in-crypto"],
    };

    const paths = [
      ...SITEMAP_INDEX_PATHS,
      ...STATIC_PATHS,
      ...sitemapPathsForKind("jobs", entries),
      ...sitemapPathsForKind("tags", entries),
      ...sitemapPathsForKind("geo", entries),
      ...sitemapPathsForKind("salaries", entries),
      ...sitemapPathsForKind("companies", entries),
      ...sitemapPathsForKind("hire", entries),
      ...sitemapPathsForKind("learn", entries),
    ];

    expect(paths.every((path) => !isExcludedSitemapPath(path))).toBe(true);
    expect(paths).not.toContain("/login");
    expect(paths).not.toContain("/talent");
    expect(paths).not.toContain("/profile");
    expect(paths.some((path) => path.startsWith("/@"))).toBe(false);
    expect(paths).toContain("/hire");
    expect(paths).toContain("/learn-web3");
    expect(paths).toContain("/hire/solidity");
    expect(paths).toContain("/learn-web3/article");
  });

  it("includes hire skill URLs for tags that already meet sitemap coverage", async () => {
    const { sitemapPathsForKind } = await import("./sitemap");
    const paths = sitemapPathsForKind("hire", {
      ...emptyEntries(),
      tagSlugs: ["solidity", "intern"],
    });

    expect(paths).toEqual(["/hire/solidity", "/hire/intern"]);
    expect(paths).not.toContain("/hire");
  });

  it("lists every learn category on the learn child sitemap", async () => {
    const { sitemapPathsForKind } = await import("./sitemap");
    const paths = sitemapPathsForKind("learn", emptyEntries());

    expect(paths).toEqual(LEARN_CATEGORIES.map((slug) => `/learn-web3/${slug}`));
    expect(paths).toContain("/learn-web3/all");
    expect(paths).toContain("/learn-web3/beginner");
    expect(paths).not.toContain("/learn-web3");
  });

  it("includes remote tag URLs and benefit landings that are not already tags", async () => {
    const { sitemapPathsForKind } = await import("./sitemap");
    const paths = sitemapPathsForKind("tags", {
      ...emptyEntries(),
      tagSlugs: ["solidity", "intern"],
      benefitSlugs: ["pay-in-crypto", "solidity"],
    });

    expect(paths).toContain("/solidity-jobs");
    expect(paths).toContain("/remote-solidity-jobs");
    expect(paths).toContain("/remote-intern-jobs");
    expect(paths).toContain("/pay-in-crypto-jobs");
    expect(paths).not.toContain("/intern-jobs");
    expect(paths.filter((path) => path === "/solidity-jobs")).toHaveLength(1);
  });

  it("uses the injected SITE_URL origin for every sitemap URL", async () => {
    const { default: sitemap } = await import("./sitemap");
    const entries = await sitemap();

    expect(entries.map(({ url }) => url)).toEqual([
      "https://jobs.example.com/sitemaps/static.xml",
      "https://jobs.example.com/sitemaps/jobs.xml",
      "https://jobs.example.com/sitemaps/tags.xml",
      "https://jobs.example.com/sitemaps/geo.xml",
      "https://jobs.example.com/sitemaps/salaries.xml",
      "https://jobs.example.com/sitemaps/companies.xml",
      "https://jobs.example.com/sitemaps/hire.xml",
      "https://jobs.example.com/sitemaps/learn.xml",
    ]);
    expect(entries.every(({ url }) => url.startsWith("https://jobs.example.com"))).toBe(true);
    expect(entries.some(({ url }) => url.includes("studio-direct.example"))).toBe(false);
    expect(entries.some(({ url }) => url.includes("placeholder.example"))).toBe(false);
  });

  it("degrades to relative child sitemap paths, without throwing, when SITE_URL is missing", async () => {
    vi.unstubAllEnvs();
    delete process.env.SITE_URL;
    const { default: sitemap, SITEMAP_INDEX_PATHS } = await import("./sitemap");

    const entries = await sitemap();

    expect(entries.map(({ url }) => url)).toEqual([...SITEMAP_INDEX_PATHS]);
  });

  it("degrades to relative child sitemap paths, without throwing, when SITE_URL is blank", async () => {
    vi.stubEnv("SITE_URL", "   ");
    const { default: sitemap } = await import("./sitemap");

    const entries = await sitemap();
    expect(entries.every(({ url }) => url.startsWith("/sitemaps/"))).toBe(true);
  });

  it("degrades to relative child sitemap paths, without throwing, for the reserved example origins", async () => {
    // studio-direct.example is the real scaffolding placeholder (crawler UA, digest.ts,
    // wrangler.jsonc, seed data); placeholder.example is the generic one. Both must be
    // refused so a live sitemap never advertises either.
    const { default: sitemap } = await import("./sitemap");

    vi.stubEnv("SITE_URL", "https://studio-direct.example");
    const studioDirectEntries = await sitemap();
    expect(studioDirectEntries.every(({ url }) => !url.includes("studio-direct.example"))).toBe(
      true,
    );
    expect(studioDirectEntries.every(({ url }) => url.startsWith("/sitemaps/"))).toBe(true);

    vi.stubEnv("SITE_URL", "https://placeholder.example");
    const placeholderEntries = await sitemap();
    expect(placeholderEntries.every(({ url }) => !url.includes("placeholder.example"))).toBe(
      true,
    );
    expect(placeholderEntries.every(({ url }) => url.startsWith("/sitemaps/"))).toBe(true);
  });

  it("splits a child sitemap into multiple files once it exceeds the 50,000 URL limit", async () => {
    const { sitemapChildPaths, SITEMAP_URL_LIMIT } = await import("./sitemap");

    expect(sitemapChildPaths("jobs", 0)).toEqual(["/sitemaps/jobs.xml"]);
    expect(sitemapChildPaths("jobs", SITEMAP_URL_LIMIT)).toEqual(["/sitemaps/jobs.xml"]);
    expect(sitemapChildPaths("jobs", SITEMAP_URL_LIMIT + 1)).toEqual([
      "/sitemaps/jobs-1.xml",
      "/sitemaps/jobs-2.xml",
    ]);
    expect(sitemapChildPaths("jobs", SITEMAP_URL_LIMIT * 2 + 1)).toEqual([
      "/sitemaps/jobs-1.xml",
      "/sitemaps/jobs-2.xml",
      "/sitemaps/jobs-3.xml",
    ]);
  });

  it("points the index at every paginated file, and no file lists more than 50,000 URLs", async () => {
    const { default: sitemap, SITEMAP_URL_LIMIT } = await import("./sitemap");
    const jobs = Array.from({ length: SITEMAP_URL_LIMIT + 5 }, (_, index) => ({
      slug: `job-${index}`,
      externalId: null,
    }));
    mocks.listSitemapEntries.mockResolvedValue({ ...emptyEntries(), jobs });

    const entries = await sitemap();
    const paths = entries.map(({ url }) => new URL(url).pathname);

    expect(paths).toContain("/sitemaps/jobs-1.xml");
    expect(paths).toContain("/sitemaps/jobs-2.xml");
    expect(paths).not.toContain("/sitemaps/jobs.xml");
  });
});

function emptyEntries() {
  return {
    jobs: [],
    companySlugs: [],
    tagSlugs: [],
    geoSlugs: [],
    salarySlugs: [],
    benefitSlugs: [],
  };
}
