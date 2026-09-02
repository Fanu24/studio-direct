import { HUB_ROLE_SLUGS, hubSlugLabel, type HubRoleSlug } from "@gaming/shared";
import Link from "next/link";

import { ArrowRightIcon } from "./icons";

export function HubLinks({
  exclude,
  limit,
  variant = "remote",
}: {
  exclude?: HubRoleSlug;
  limit?: number;
  variant?: "remote" | "skill";
}) {
  const slugs = HUB_ROLE_SLUGS.filter((slug) => slug !== exclude).slice(
    0,
    limit ?? HUB_ROLE_SLUGS.length,
  );

  return (
    <ul className="hub-grid">
      {slugs.map((slug) => {
        const label = hubSlugLabel(slug);
        const href = variant === "remote" ? `/remote-${slug}-jobs` : `/skills/${slug}`;
        return (
          <li key={slug}>
            <Link href={href}>
              <span>{variant === "remote" ? `Remote ${label} jobs` : `${label} jobs`}</span>
              <ArrowRightIcon size={16} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
