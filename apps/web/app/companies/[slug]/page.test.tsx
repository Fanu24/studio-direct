import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  permanentRedirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));

describe("CompanyRedirect", () => {
  it("permanently redirects the old profile path to the canonical /web3-companies/:slug", async () => {
    const { default: CompanyRedirect } = await import("./page");
    await expect(
      CompanyRedirect({ params: Promise.resolve({ slug: "alpha" }) }),
    ).rejects.toThrow("REDIRECT:/web3-companies/alpha");
  });

  it("decodes a percent-encoded segment before rebuilding the canonical URL", async () => {
    const { default: CompanyRedirect } = await import("./page");
    await expect(
      CompanyRedirect({ params: Promise.resolve({ slug: "alpha%2Bbeta" }) }),
    ).rejects.toThrow("REDIRECT:/web3-companies/alpha%2Bbeta");
  });
});
