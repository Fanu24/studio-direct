import type { JobDraft } from "./jobs.ts";

type StaffingDraft = Pick<JobDraft, "companyName" | "title" | "descriptionHtml">;

type StaffingOptions = {
  allowlistedCompany: boolean;
};

const AGENCY_COMPANY_PATTERN =
  /\b(?:recruit(?:ment|ers?|ing)|staffing|talent\s+(?:agency|solutions)|employment\s+agency|search\s+partners?)\b/i;

const AGENCY_DESCRIPTION_PATTERNS = [
  /\b(?:recruitment|staffing|employment)\s+agency\b/i,
  /\b(?:recruiting|hiring)\s+(?:for|on behalf of)\s+(?:our|a|the)\s+client\b/i,
  /\bcontract\s+roles?\s+available\b/i,
  /\bRPO\s+(?:partner|provider|services?)\b/i,
  /\b(?:people2\.0|allegisgroup|cpl\.com|randstad|manpowergroup)\b/i,
];

const CLEAR_AGENCY_TITLE_PATTERNS = [
  /\b(?:recruitment|staffing|employment)\s+agency\b/i,
  /\brecruiter\s+posting\b/i,
  /\bcontract\s+roles?\s+available\b/i,
  /\bmultiple\s+contract\s+roles?\b/i,
];

export function isStaffingDraft(
  draft: StaffingDraft,
  { allowlistedCompany }: StaffingOptions,
): boolean {
  if (allowlistedCompany) {
    return CLEAR_AGENCY_TITLE_PATTERNS.some((pattern) => pattern.test(draft.title));
  }

  if (AGENCY_COMPANY_PATTERN.test(draft.companyName)) return true;

  return AGENCY_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(draft.descriptionHtml));
}
