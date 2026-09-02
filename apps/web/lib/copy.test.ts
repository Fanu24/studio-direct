import { describe, expect, it } from "vitest";

import { HOMEPAGE_CLAIM } from "./copy";

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
