import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  salaryRolePage: vi.fn(async () => "rendered"),
  salaryMetadata: vi.fn(async () => ({ title: "meta" })),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("../../web3-salaries/[slug]/page", () => ({
  default: mocks.salaryRolePage,
  generateMetadata: mocks.salaryMetadata,
}));

import NonTechSalarySlugPage, { generateMetadata } from "./page";

const render = (slug: string) => NonTechSalarySlugPage({ params: Promise.resolve({ slug }) });

describe("/web3-non-tech-salaries/[slug]", () => {
  it("serves a non-tech role", async () => {
    await expect(render("marketing")).resolves.toBe("rendered");
  });

  // This hub carries a geography dimension too. Gating on the role list alone 404'd all 38
  // country/region/city URLs the reference links here, even though the underlying page has
  // always rendered those kinds at /web3-salaries/*.
  it("serves a country, a region and a city", async () => {
    await expect(render("germany")).resolves.toBe("rendered");
    await expect(render("europe")).resolves.toBe("rendered");
    await expect(render("berlin")).resolves.toBe("rendered");
  });

  it("404s a tech role, which belongs to the other hub", async () => {
    await expect(render("solidity-developer")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s an unknown slug", async () => {
    await expect(render("not-a-real-page")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("applies the same gate to metadata, so a 404 page emits no title", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "not-a-real-page" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "germany" }) }),
    ).resolves.toEqual({ title: "meta" });
  });
});
