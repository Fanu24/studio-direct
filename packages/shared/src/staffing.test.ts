import { describe, expect, it } from "vitest";
import type { JobDraft } from "./jobs.ts";
import { isStaffingDraft } from "./index.ts";

const draft = (
  overrides: Partial<Pick<JobDraft, "companyName" | "title" | "descriptionHtml">> = {},
) => ({
  companyName: "Example Studio",
  title: "Gameplay Engineer",
  descriptionHtml: "<p>Build gameplay systems.</p>",
  ...overrides,
});

describe("isStaffingDraft", () => {
  it.each([
    "Pixel Recruitment",
    "Level Up Staffing",
    "Game Talent Agency",
  ])("drops an agency company name: %s", (companyName) => {
    expect(isStaffingDraft(draft({ companyName }), { allowlistedCompany: false })).toBe(true);
  });

  it.each([
    "<p>We are a recruitment agency hiring for our client.</p>",
    "<p>Multiple contract roles available across our client studios.</p>",
    "<p>Apply through our RPO partner at jobs@people2.0.com.</p>",
    "<p>We provide staffing solutions for game studios.</p>",
    "<p>A recruitment consultancy working with multiple clients.</p>",
    "<p>Our recruitment services connect studios with developers.</p>",
  ])("drops an agency description", (descriptionHtml) => {
    expect(
      isStaffingDraft(draft({ descriptionHtml }), { allowlistedCompany: false }),
    ).toBe(true);
  });

  it("keeps an allowlisted studio despite agency wording outside the title", () => {
    expect(
      isStaffingDraft(
        draft({
          companyName: "Recruitment Games",
          descriptionHtml: "<p>Recruitment for this permanent role is now open.</p>",
        }),
        { allowlistedCompany: true },
      ),
    ).toBe(false);
  });

  it.each([
    "Recruiter posting: multiple contract roles",
    "Staffing Agency - Game Developers Wanted",
    "Recruitment Agency Opportunities",
  ])("drops a clearly agency title even for an allowlisted studio: %s", (title) => {
    expect(isStaffingDraft(draft({ title }), { allowlistedCompany: true })).toBe(true);
  });

  it("keeps a regular studio listing", () => {
    expect(isStaffingDraft(draft(), { allowlistedCompany: false })).toBe(false);
  });
});
