export type Source =
  | "career_page"
  | "linkedin"
  | "indeed"
  | "web3_career_api"
  | "ats"
  | "manual";

export type JobDraft = {
  source: Source;
  sourceUrl: string;
  companyName: string;
  title: string;
  location: string | null;
  remote: "remote" | "hybrid" | "onsite" | "unknown";
  descriptionHtml: string;
  applyUrl: string;
  postedAt: string | null;
  rawJson: string;
  externalId?: string | null;
  tags?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryText?: string | null;
  keepApplyUrl?: boolean;
};

export type QueueMessage =
  | { kind: "career"; companyId: string }
  | { kind: "linkedin"; query: string }
  | { kind: "indeed"; query: string }
  | { kind: "web3_api"; tag?: string; country?: string; remote?: boolean };

export interface JobSource {
  fetch(message: QueueMessage): Promise<JobDraft[]>;
}

export function isQueueMessage(value: unknown): value is QueueMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.type !== undefined) return false;
  if (v.kind === "career") return typeof v.companyId === "string";
  if (v.kind === "linkedin" || v.kind === "indeed") return typeof v.query === "string";
  if (v.kind === "web3_api") {
    return (
      (v.tag === undefined || typeof v.tag === "string") &&
      (v.country === undefined || typeof v.country === "string") &&
      (v.remote === undefined || typeof v.remote === "boolean")
    );
  }
  return false;
}
