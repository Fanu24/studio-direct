import { sanitizeJobDescriptionHtml } from "./sanitize-description";

export const META_DESCRIPTION_LIMIT = 158;

const MIN_LEAD_BLOCK_LENGTH = 40;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1]?.toLowerCase() === "x"
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * First sentence of the first real paragraph in an HTML fragment. Headings are dropped and
 * short label-like blocks ("About the role") are skipped so the meta description starts with
 * an actual sentence.
 */
export function firstSentence(html: string): string {
  const blocks = html
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "\n")
    .replace(
      /<\/(?:p|li|div|section|article|blockquote|tr|dd|dt|summary|figcaption|pre)>|<(?:br|hr)\s*\/?>/gi,
      "\n",
    )
    .replace(/<[^>]*>/g, " ")
    .split("\n")
    .map((block) => decodeEntities(block).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const text = blocks.find((block) => block.length >= MIN_LEAD_BLOCK_LENGTH) ?? blocks[0] ?? "";
  const match = /^(.+?[.!?])(?:\s|$)/.exec(text);
  return (match ? match[1] : text).trim();
}

export function clampWords(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit + 1);
  const boundary = cut.lastIndexOf(" ");
  return cut.slice(0, boundary > 0 ? boundary : limit).replace(/[\s,;:]+$/, "");
}

/** Meta description: where, pay, then the opening sentence of the description. */
export function buildMetaDescription(job: {
  title: string;
  companyName: string;
  /** Precomputed place label - e.g. "Remote, London" or "Hybrid" - so this module never
   * needs to know how remote/location codes map to copy (that stays in job-card.tsx). */
  where: string;
  salaryText: string | null;
  descriptionHtml: string;
}): string {
  const facts = [`${job.title} at ${job.companyName}`, job.where];
  if (job.salaryText) facts.push(job.salaryText);
  const base = `${facts.join(". ")}.`;

  const sentence = firstSentence(sanitizeJobDescriptionHtml(job.descriptionHtml));
  if (!sentence) return clampWords(base, META_DESCRIPTION_LIMIT);

  const full = `${base} ${sentence}`;
  if (full.length <= META_DESCRIPTION_LIMIT) return full;
  if (base.length >= META_DESCRIPTION_LIMIT - 12) {
    return clampWords(base, META_DESCRIPTION_LIMIT);
  }
  return clampWords(full, META_DESCRIPTION_LIMIT);
}

/**
 * Title tag: role, pay and geo in one string so long-tail salary/location searches match
 * ("{title} {salary} in {place} at {company}"). Pay and place are both optional - a role with
 * neither still reads naturally as "{title} at {company}".
 */
export function buildJobTitle(job: {
  title: string;
  companyName: string;
  /** Precomputed location-or-remote-label, e.g. "London" or "Remote". Empty when neither is known. */
  place: string;
  salaryText: string | null;
}): string {
  const pay = job.salaryText ? ` ${job.salaryText}` : "";
  return job.place
    ? `${job.title}${pay} in ${job.place} at ${job.companyName}`
    : `${job.title}${pay} at ${job.companyName}`;
}
