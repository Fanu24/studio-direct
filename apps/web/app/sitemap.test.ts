import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listSitemapEntries: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../lib/jobs/queries", () => ({
  listSitemapEntries: mocks.listSitemapEntries,
}));

describe("sitemap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("SITE_URL", "https://jobs.example.com");
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    mocks.listSitemapEntries.mockResolvedValue({
      companySlugs: ["alpha-studio"],
      jobSlugs: ["gameplay-engineer"],
    });
  });

  it("includes public SEO pages and excludes the private profile route", async () => {
    const { default: sitemap } = await import("./sitemap");
    const entries = await sitemap();
    const paths = entries.map(({ url }) => new URL(url).pathname);

    expect(paths).toEqual(expect.arrayContaining([
      "/",
      "/jobs",
      "/hidden-jobs",
      "/pricing",
      "/companies",
      "/roles",
      "/about",
      "/terms",
      "/privacy",
      "/remote-gameplay-programmer-jobs",
      "/skills/gameplay-programmer",
      "/jobs/gameplay-engineer",
      "/companies/alpha-studio",
    ]));
    expect(paths).not.toContain("/profile");
    expect(paths).not.toContain("/settings");
    expect(paths).not.toContain("/login");
    expect(paths).not.toContain("/onboarding");
    expect(paths.some((path) => path === "/talent" || path.startsWith("/talent/"))).toBe(false);
  });

  it("uses the injected SITE_URL origin for every sitemap URL", async () => {
    const { default: sitemap } = await import("./sitemap");
    const entries = await sitemap();

    expect(entries.map(({ url }) => url)).toEqual(
      expect.arrayContaining([
        "https://jobs.example.com/",
        "https://jobs.example.com/jobs",
        "https://jobs.example.com/hidden-jobs",
        "https://jobs.example.com/jobs/gameplay-engineer",
        "https://jobs.example.com/companies/alpha-studio",
      ]),
    );
    expect(entries.every(({ url }) => url.startsWith("https://jobs.example.com"))).toBe(true);
    expect(entries.some(({ url }) => url.includes("studio-direct.example"))).toBe(false);
  });

  it("fails clearly when SITE_URL is missing", async () => {
    vi.unstubAllEnvs();
    delete process.env.SITE_URL;
    const { default: sitemap } = await import("./sitemap");

    await expect(sitemap()).rejects.toThrow(/SITE_URL/);
  });

  it("fails clearly when SITE_URL is empty", async () => {
    vi.stubEnv("SITE_URL", "   ");
    const { default: sitemap } = await import("./sitemap");

    await expect(sitemap()).rejects.toThrow(/SITE_URL/);
  });

  it("rejects the reserved example origin", async () => {
    vi.stubEnv("SITE_URL", "https://studio-direct.example");
    const { default: sitemap } = await import("./sitemap");

    await expect(sitemap()).rejects.toThrow(/SITE_URL/);
  });
});
