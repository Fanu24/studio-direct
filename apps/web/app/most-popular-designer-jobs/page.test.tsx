import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  permanentRedirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));

describe("MostPopularDesignerJobsPage", () => {
  it("redirects the singular spelling to the canonical plural route", async () => {
    const { default: MostPopularDesignerJobsPage } = await import("./page");
    expect(() => MostPopularDesignerJobsPage()).toThrow(
      "REDIRECT:/most-popular-designers-jobs",
    );
  });
});
