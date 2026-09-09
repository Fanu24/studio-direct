import { FEATURED_TAG_CHIPS } from "@gaming/shared";

const POPULAR_DEV_TAGS = [
  "solidity",
  "rust",
  "solana",
  "smart-contract",
  "backend",
  "front-end",
  "full-stack",
  "golang",
  "javascript",
  "react",
  "node",
  "evm",
  "cryptography",
  "zero-knowledge",
] as const;

const POPULAR_TAG_SET = new Set<string>(POPULAR_DEV_TAGS);

export const POPULAR_DEV_CHIPS = FEATURED_TAG_CHIPS.filter((tag) =>
  POPULAR_TAG_SET.has(tag),
);
