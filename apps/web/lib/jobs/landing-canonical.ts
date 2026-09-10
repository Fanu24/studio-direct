import { landingPath, parseLandingSegment } from "@gaming/shared";

/**
 * Combo landings (`/backend+remote-jobs`) are order-insensitive to the
 * parser: `/remote+backend-jobs` resolves to the exact same slice. Serving
 * both at 200 splits the slice across two indexable URLs, so the
 * non-canonical order 308s to `landingPath`'s canonical spelling instead -
 * the same thing web3.career does (it 301s `/solidity+remote-jobs` to
 * `/remote+solidity-jobs`).
 *
 * Scope is deliberately narrow: only slugs that literally contain a "+" are
 * candidates. The hyphenated legacy shape `/remote-solidity-jobs` parses to
 * the same landing but is a real 200 on the reference too, so it keeps its
 * status and canonicalises through the `<link rel=canonical>` tag alone.
 *
 * The segment arrives from the router still percent-encoded
 * ("remote%2Bsolidity-jobs"), so it is decoded here exactly the way
 * parseLandingSegment decodes it. That matters: an encoded combo decodes to
 * the canonical spelling and must NOT redirect, or the route loops.
 */
export function landingComboRedirect(segment: string): string | null {
  let raw = segment.trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Malformed escape sequence: compare against the segment as given.
  }
  const slug = raw.toLowerCase().replace(/ /g, "+");
  if (!slug.includes("+")) return null;

  const landing = parseLandingSegment(segment);
  if (!landing) return null;

  const canonical = landingPath(landing);
  return canonical === `/${slug}` ? null : canonical;
}
