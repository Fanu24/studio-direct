export const PACKAGE_NAME = "@gaming/shared";

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


