export const GAMING_ROLES = [
  "unity",
  "unreal",
  "gameplay programmer",
  "engine programmer",
  "technical artist",
  "animator",
] as const;

export const WORK_LOCATION_MODIFIERS = ["remote", "hybrid"] as const;

export const REMOTE_GAMING_QUERIES: readonly string[] = GAMING_ROLES.flatMap(
  (role) => WORK_LOCATION_MODIFIERS.map((modifier) => `${role} ${modifier}`),
);
