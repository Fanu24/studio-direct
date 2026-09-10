import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  permanentRedirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));

describe("HighestPaidDevelopersJobsPage", () => {
  it("redirects the plural spelling to the canonical singular route", async () => {
    const { default: HighestPaidDevelopersJobsPage } = await import("./page");
    expect(() => HighestPaidDevelopersJobsPage()).toThrow(
      "REDIRECT:/highest-paid-developer-jobs",
    );
  });
});
