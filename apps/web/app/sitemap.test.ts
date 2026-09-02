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
    vi.clearAllMocks();
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
      "/remote-gameplay-programmer-jobs",
      "/skills/gameplay-programmer",
      "/jobs/gameplay-engineer",
      "/companies/alpha-studio",
    ]));
    expect(paths).not.toContain("/profile");
    expect(paths).not.toContain("/login");
    expect(paths.some((path) => path === "/talent" || path.startsWith("/talent/"))).toBe(false);
  });
});
