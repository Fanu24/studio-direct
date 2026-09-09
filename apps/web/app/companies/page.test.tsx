import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  permanentRedirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));

describe("CompaniesRedirect", () => {
  it("permanently redirects the old index path to the canonical /web3-companies", async () => {
    const { default: CompaniesRedirect } = await import("./page");
    expect(() => CompaniesRedirect()).toThrow("REDIRECT:/web3-companies");
  });
});
