import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  permanentRedirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));

describe("TopGrowingRedirect", () => {
  it("permanently redirects to the canonical /web3-companies/top-growing", async () => {
    const { default: TopGrowingRedirect } = await import("./page");
    expect(() => TopGrowingRedirect()).toThrow("REDIRECT:/web3-companies/top-growing");
  });
});
