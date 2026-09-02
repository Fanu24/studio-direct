import { describe, expect, it } from "vitest";

import {
  computeExclusivity,
  jaccard,
  linkedinTitlesMatch,
} from "./exclusivity.ts";

const now = new Date("2026-09-02T12:00:00.000Z");

describe("jaccard", () => {
  it("compares unique title tokens", () => {
    expect(
      jaccard(
        ["senior", "gameplay", "engineer"],
        ["gameplay", "software", "engineer"],
      ),
    ).toBe(0.5);
  });
});

describe("linkedinTitlesMatch", () => {
  it("matches the same job with a different title above the threshold", () => {
    expect(
      linkedinTitlesMatch(
        "Senior Gameplay Software Engineer",
        "Senior Gameplay Engineer",
      ),
    ).toBe(true);
  });

  it("matches identical non-Latin titles", () => {
    expect(
      linkedinTitlesMatch(
        "ゲームプレイエンジニア",
        "ゲームプレイエンジニア",
      ),
    ).toBe(true);
  });

  it("does not match unrelated titles", () => {
    expect(
      linkedinTitlesMatch("Senior Gameplay Engineer", "Technical Artist"),
    ).toBe(false);
  });
});

describe("computeExclusivity", () => {
  it("marks a career job hidden when a fresh LinkedIn index has no match", () => {
    expect(
      computeExclusivity({
        hasCareer: true,
        linkedinSighting: false,
        linkedinFresh: true,
        postedAtIso: "2026-08-20T10:00:00.000Z",
        now,
      }),
    ).toBe("hidden_from_linkedin");
  });

  it("marks a recent LinkedIn sighting as on boards", () => {
    expect(
      computeExclusivity({
        hasCareer: true,
        linkedinSighting: true,
        linkedinFresh: true,
        postedAtIso: "2026-08-20T10:00:00.000Z",
        now,
      }),
    ).toBe("on_boards");
  });

  it("does not match a 46-day-old LinkedIn posting", () => {
    expect(
      computeExclusivity({
        hasCareer: true,
        linkedinSighting: true,
        linkedinFresh: true,
        postedAtIso: "2026-07-18T12:00:00.000Z",
        now,
      }),
    ).toBe("hidden_from_linkedin");
  });

  it("keeps exclusivity unknown when the LinkedIn index is stale", () => {
    expect(
      computeExclusivity({
        hasCareer: true,
        linkedinSighting: true,
        linkedinFresh: false,
        postedAtIso: "2026-08-20T10:00:00.000Z",
        now,
      }),
    ).toBe("unknown");
  });
});
