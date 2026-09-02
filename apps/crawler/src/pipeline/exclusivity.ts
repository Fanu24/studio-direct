import {
  computeExclusivity,
  linkedinTitlesMatch,
  normalizeCompanyName,
  type Exclusivity,
} from "@gaming/shared";

const LINKEDIN_FRESHNESS_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

export type LinkedinBadgeRun = {
  ok: boolean;
  finishedAtIso: string;
  parseableDrafts: number;
};

export type ExclusivityJobIdentity = {
  companyName: string;
  title: string;
  postedAtIso: string | null;
};

export function linkedinFreshForBadge(
  run: LinkedinBadgeRun | null,
  now: Date,
): boolean {
  if (!run?.ok || run.parseableDrafts <= 0) return false;

  const finishedAt = new Date(run.finishedAtIso);
  const ageMs = now.getTime() - finishedAt.getTime();
  return (
    !Number.isNaN(finishedAt.getTime()) &&
    ageMs >= 0 &&
    ageMs <= LINKEDIN_FRESHNESS_MAX_AGE_MS
  );
}

export function recomputeExclusivity({
  hasCareer,
  careerJob,
  linkedinSightings,
  linkedinRun,
  now,
}: {
  hasCareer: boolean;
  careerJob: ExclusivityJobIdentity;
  linkedinSightings: readonly ExclusivityJobIdentity[];
  linkedinRun: LinkedinBadgeRun | null;
  now: Date;
}): Exclusivity {
  const linkedinFresh = linkedinFreshForBadge(linkedinRun, now);
  const companyName = normalizeCompanyName(careerJob.companyName);
  const match = linkedinSightings.find(
    (sighting) =>
      normalizeCompanyName(sighting.companyName) === companyName &&
      linkedinTitlesMatch(careerJob.title, sighting.title) &&
      computeExclusivity({
        hasCareer,
        linkedinSighting: true,
        linkedinFresh,
        postedAtIso: sighting.postedAtIso,
        now,
      }) === "on_boards",
  );

  return computeExclusivity({
    hasCareer,
    linkedinSighting: match !== undefined,
    linkedinFresh,
    postedAtIso: match?.postedAtIso ?? null,
    now,
  });
}
