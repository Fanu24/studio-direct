import { describe, expect, it } from "vitest";
import { canonicalApplyUrl, normalizeCompanyName, slugTitle } from "./normalize.ts";

describe("normalizeCompanyName", () => {
  it("maps Ubisoft Entertainment to ubisoft", () => {
    expect(normalizeCompanyName("Ubisoft Entertainment")).toBe("ubisoft");
  });
});

describe("canonicalApplyUrl", () => {
  it("strips tracking params", () => {
    expect(
      canonicalApplyUrl("https://jobs.example.com/x?gh_jid=1&utm_source=li"),
    ).toBe("https://jobs.example.com/x?gh_jid=1");
  });
});

describe("slugTitle", () => {
  it("slugs gameplay titles", () => {
    expect(slugTitle("Senior Gameplay Engineer (Remote)")).toBe(
      "senior-gameplay-engineer-remote",
    );
  });
});
