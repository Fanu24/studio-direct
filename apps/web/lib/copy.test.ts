import { describe, expect, it } from "vitest";

import { HOMEPAGE_CLAIM, LINKEDIN_EXCLUSIVITY_TOOLTIP } from "./copy";

describe("HOMEPAGE_CLAIM", () => {
  it("uses the approved career-page claim verbatim", () => {
    expect(HOMEPAGE_CLAIM).toBe(
      "Jobs from studio career pages, including roles not posted on LinkedIn.",
    );
  });

  it("does not make a 100% claim", () => {
    expect(HOMEPAGE_CLAIM).not.toContain("100%");
  });
});

describe("LINKEDIN_EXCLUSIVITY_TOOLTIP", () => {
  it("uses the approved last-index qualification verbatim", () => {
    expect(LINKEDIN_EXCLUSIVITY_TOOLTIP).toBe(
      "We did not find this role on LinkedIn in our last successful index.",
    );
  });
});
