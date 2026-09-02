import { describe, expect, it } from "vitest";

import {
  linkedinFreshForBadge,
  recomputeExclusivity,
} from "./exclusivity";

const now = new Date("2026-09-02T12:00:00.000Z");
const freshRun = {
  ok: true,
  finishedAtIso: "2026-09-02T11:00:00.000Z",
  parseableDrafts: 4,
};
const careerJob = {
  companyName: "Moonshot Games Studio",
  title: "Senior Gameplay Software Engineer",
  postedAtIso: "2026-08-20T10:00:00.000Z",
};

describe("linkedinFreshForBadge", () => {
  it("does not treat an empty successful run as fresh for badges", () => {
    expect(
      linkedinFreshForBadge(
        { ...freshRun, parseableDrafts: 0 },
        now,
      ),
    ).toBe(false);
  });

  it("requires the successful non-empty run to be within 24 hours", () => {
    expect(
      linkedinFreshForBadge(
        { ...freshRun, finishedAtIso: "2026-09-01T11:59:59.999Z" },
        now,
      ),
    ).toBe(false);
  });
});

describe("recomputeExclusivity", () => {
  it("matches the same job when LinkedIn uses a different title", () => {
    expect(
      recomputeExclusivity({
        hasCareer: true,
        careerJob,
        linkedinSightings: [
          {
            companyName: "Moonshot Games",
            title: "Senior Gameplay Engineer",
            postedAtIso: "2026-08-20T10:00:00.000Z",
          },
        ],
        linkedinRun: freshRun,
        now,
      }),
    ).toBe("on_boards");
  });

  it("matches the same job when both titles are non-Latin", () => {
    expect(
      recomputeExclusivity({
        hasCareer: true,
        careerJob: {
          ...careerJob,
          title: "ゲームプレイエンジニア",
        },
        linkedinSightings: [
          {
            companyName: careerJob.companyName,
            title: "ゲームプレイエンジニア",
            postedAtIso: "2026-08-20T10:00:00.000Z",
          },
        ],
        linkedinRun: freshRun,
        now,
      }),
    ).toBe("on_boards");
  });

  it("does not match an identical title from a different company", () => {
    expect(
      recomputeExclusivity({
        hasCareer: true,
        careerJob,
        linkedinSightings: [
          {
            companyName: "Other Worlds Studio",
            title: careerJob.title,
            postedAtIso: "2026-08-20T10:00:00.000Z",
          },
        ],
        linkedinRun: freshRun,
        now,
      }),
    ).toBe("hidden_from_linkedin");
  });

  it("does not match a 46-day-old LinkedIn posting", () => {
    expect(
      recomputeExclusivity({
        hasCareer: true,
        careerJob,
        linkedinSightings: [
          {
            companyName: careerJob.companyName,
            title: careerJob.title,
            postedAtIso: "2026-07-18T12:00:00.000Z",
          },
        ],
        linkedinRun: freshRun,
        now,
      }),
    ).toBe("hidden_from_linkedin");
  });

  it("keeps the result unknown when the LinkedIn index is stale", () => {
    expect(
      recomputeExclusivity({
        hasCareer: true,
        careerJob,
        linkedinSightings: [],
        linkedinRun: {
          ...freshRun,
          finishedAtIso: "2026-09-01T11:59:59.999Z",
        },
        now,
      }),
    ).toBe("unknown");
  });
});
