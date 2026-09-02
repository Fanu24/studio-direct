const LINKEDIN_TITLE_MATCH_THRESHOLD = 0.55;
const LINKEDIN_POSTING_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1_000;

export type Exclusivity =
  | "hidden_from_linkedin"
  | "on_boards"
  | "unknown";

export type ComputeExclusivityInput = {
  hasCareer: boolean;
  linkedinSighting: boolean;
  linkedinFresh: boolean;
  postedAtIso: string | null;
  now: Date;
};

function titleTokens(title: string): string[] {
  return normalizeTitle(title)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeTitle(title: string): string {
  return title.normalize("NFKC").toLocaleLowerCase().trim().replace(/\s+/gu, " ");
}

export function jaccard(a: string[], b: string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  const union = new Set([...left, ...right]);

  if (union.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of left) {
    if (right.has(token)) intersectionSize += 1;
  }
  return intersectionSize / union.size;
}

export function linkedinTitlesMatch(a: string, b: string): boolean {
  const leftTokens = titleTokens(a);
  const rightTokens = titleTokens(b);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    const leftTitle = normalizeTitle(a);
    return leftTitle.length > 0 && leftTitle === normalizeTitle(b);
  }

  return jaccard(leftTokens, rightTokens) >= LINKEDIN_TITLE_MATCH_THRESHOLD;
}

export function computeExclusivity({
  hasCareer,
  linkedinSighting,
  linkedinFresh,
  postedAtIso,
  now,
}: ComputeExclusivityInput): Exclusivity {
  if (!linkedinFresh) return "unknown";

  if (linkedinSighting && postedAtIso) {
    const postedAt = new Date(postedAtIso);
    const ageMs = now.getTime() - postedAt.getTime();
    if (
      !Number.isNaN(postedAt.getTime()) &&
      ageMs >= 0 &&
      ageMs <= LINKEDIN_POSTING_MAX_AGE_MS
    ) {
      return "on_boards";
    }
  }

  return hasCareer ? "hidden_from_linkedin" : "unknown";
}
