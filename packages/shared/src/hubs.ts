export const HUB_ROLE_SLUGS = [
  "gameplay-programmer",
  "engine-programmer",
  "graphics-programmer",
  "tools-programmer",
  "technical-artist",
  "technical-designer",
  "game-designer",
  "narrative-designer",
  "producer",
  "qa",
  "live-ops",
  "community",
  "audio",
  "ui-ux",
  "unity",
  "unreal",
  "godot",
  "multiplayer",
] as const;

export type HubRoleSlug = (typeof HUB_ROLE_SLUGS)[number];

const hubRoleSlugs: ReadonlySet<string> = new Set(HUB_ROLE_SLUGS);

export function isHubRoleSlug(slug: string): slug is HubRoleSlug {
  return hubRoleSlugs.has(slug);
}

export function parseRoleHubSegment(segment: string): HubRoleSlug | undefined {
  const match = /^remote-(.+)-jobs$/.exec(segment);
  const slug = match?.[1];
  return slug && isHubRoleSlug(slug) ? slug : undefined;
}

export function hubSlugLabel(slug: HubRoleSlug): string {
  if (slug === "qa") return "QA";
  if (slug === "ui-ux") return "UI/UX";
  return slug
    .split("-")
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}
