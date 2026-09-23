import { FEATURED_TAG_CHIPS, landingPath, tagLabel } from "@gaming/shared";
import {searchHref, type SearchState} from '../../lib/jobs/search-state';
import Link from "next/link";

export const COMPACT_TAG_CHIPS = [
  "community-manager",
  "customer-support",
  "design",
  "entry-level",
  "intern",
  "marketing",
  "non-tech",
] as const;

const COMPACT = new Set<string>(COMPACT_TAG_CHIPS);

export const EXTRA_TAG_CHIPS = FEATURED_TAG_CHIPS.filter((tag) => !COMPACT.has(tag));

/**
 * `active` takes either a single tag (existing callers) or several (a combo
 * landing has more than one chip lit at once) - both are normalized to a set
 * below, so passing a plain string keeps working unchanged.
 *
 * `remote` says whether the page we're chip-browsing from is itself a remote
 * landing: when true, every chip's href is built through the remote-tag
 * LandingKind instead of the plain tag one, so clicking a chip from a remote
 * page keeps the remote filter instead of silently dropping it.
 */
export function TagChips({
  active,
  remote = false,
  filters,
}: {
  active?: string | string[];
  remote?: boolean;
  filters?: SearchState;
}) {
  const activeTags = new Set(
    Array.isArray(active) ? active : active ? [active] : [],
  );
  const hrefFor = (tag: string) => filters && Object.keys(filters).some(key=> !['tag','tags','remote'].includes(key))
    ? searchHref(filters,{tag,tags:undefined,...(remote?{remote:'1'}:{})}) : landingPath(
      remote
        ? { kind: "remote-tag", tag, tags: [tag] }
        : { kind: "tag", tag, tags: [tag] },
    );

  return (
    <div className="tag-chip-board">
      <input className="chips-more" id="show-more-tags" type="checkbox" />
      <div className="chips chips--catalog chips--compact">
        {COMPACT_TAG_CHIPS.map((tag) => (
          <Link
            className={`chip${activeTags.has(tag) ? " chip--on" : ""}`}
            href={hrefFor(tag)}
            key={tag}
          >
            {tagLabel(tag)}
          </Link>
        ))}
      </div>
      <div className="chips chips--catalog chips--extra">
        {EXTRA_TAG_CHIPS.map((tag) => (
          <Link
            className={`chip${activeTags.has(tag) ? " chip--on" : ""}`}
            href={hrefFor(tag)}
            key={tag}
          >
            {tagLabel(tag)}
          </Link>
        ))}
      </div>
      <label className="chip chip--more" htmlFor="show-more-tags">
        <span className="chip--more-open">Show more</span>
        <span className="chip--more-close">Show less</span>
      </label>
    </div>
  );
}
