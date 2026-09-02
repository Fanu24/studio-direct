export const PACKAGE_NAME = "@gaming/shared";

export {
  GAMING_ROLES,
  REMOTE_GAMING_QUERIES,
  WORK_LOCATION_MODIFIERS,
} from "./dictionary.ts";
export type { JobDraft, JobSource, QueueMessage, Source } from "./jobs.ts";
export { isQueueMessage } from "./jobs.ts";
export {
  canonicalApplyUrl,
  canonicalKeyFromUrls,
  normalizeCompanyName,
  slugTitle,
} from "./normalize.ts";
export { acquireHostLock } from "./host-lock.ts";
export type { HostLockKv } from "./host-lock.ts";
export { classifyRemote } from "./remote.ts";
export { isStaffingDraft } from "./staffing.ts";
export {
  computeExclusivity,
  jaccard,
  linkedinTitlesMatch,
} from "./exclusivity.ts";
export type {
  ComputeExclusivityInput,
  Exclusivity,
} from "./exclusivity.ts";


