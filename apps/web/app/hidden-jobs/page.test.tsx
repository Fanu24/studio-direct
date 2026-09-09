import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({
  permanentRedirect: mocks.permanentRedirect,
}));

describe("HiddenJobsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permanently redirects the LinkedIn hub to remote jobs", async () => {
    const { default: HiddenJobsPage } = await import("./page");

    expect(() => HiddenJobsPage()).toThrow("REDIRECT:/remote-jobs");
    expect(mocks.permanentRedirect).toHaveBeenCalledWith("/remote-jobs");
  });
});
