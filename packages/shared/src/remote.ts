import type { JobDraft } from "./jobs.ts";

type RemoteInput = Pick<JobDraft, "title" | "location" | "descriptionHtml">;

const HYBRID_WORDS = [
  /\bhybrid\b/i,
  /\b[1-4]\s+days?\s+(?:per week\s+)?(?:in (?:the )?)?office\b/i,
  /\bsplit\s+(?:between|time)\b.*\b(?:home|office)\b/i,
];

const ONSITE_WORDS = [
  /\bon[\s-]?site\b/i,
  /\boffice[\s-]based\b/i,
  /\b(?:5|five)\s+days?\s+(?:per week\s+)?(?:in (?:the )?)?office\b/i,
  /\bwork(?:ing)?\s+from\s+(?:the\s+)?office\b/i,
];

const REMOTE_WORDS = [
  /\bremote\b/i,
  /\bwork(?:ing)?\s+from\s+home\b/i,
  /\bWFH\b/i,
  /\bhome[\s-]based\b/i,
  /\bdistributed\b/i,
  /\bwork\s+from\s+anywhere\b/i,
];

function containsAny(text: string, words: readonly RegExp[]): boolean {
  return words.some((word) => word.test(text));
}

export function classifyRemote(input: RemoteInput): JobDraft["remote"] {
  const text = [input.title, input.location ?? "", input.descriptionHtml]
    .join(" ")
    .replace(/<[^>]*>/g, " ");

  if (containsAny(text, HYBRID_WORDS)) return "hybrid";
  if (containsAny(text, ONSITE_WORDS)) return "onsite";
  if (containsAny(text, REMOTE_WORDS)) return "remote";
  return "unknown";
}
