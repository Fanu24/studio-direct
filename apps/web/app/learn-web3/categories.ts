import { isJobTag } from "@gaming/shared";

export const LEARN_FORMATS = [
  "article",
  "book",
  "bootcamp",
  "challenge",
  "course",
  "interview",
  "news",
  "open-source",
  "tutorial",
  "video",
  "whitepaper",
] as const;

export const LEARN_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export const LEARN_TOPICS = [
  "a16z",
  "ai",
  "bitcoin",
  "blockchain",
  "blockchain-engineer",
  "btc",
  "career-advice",
  "clojure",
  "community-manager",
  "computer-science",
  "crypto",
  "cryptography",
  "css",
  "dao",
  "dapp",
  "defi",
  "discord",
  "eos",
  "erc",
  "erc-20",
  "ethereum",
  "finance",
  "ganache",
  "gpt",
  "hardhat",
  "hr",
  "interview-questions",
  "java",
  "javascript",
  "machine-learning",
  "nextjs",
  "nft",
  "nlp",
  "node",
  "non-tech",
  "openzeppelin",
  "php",
  "polygon",
  "prompt",
  "python",
  "react",
  "recruiter",
  "remix",
  "ruby",
  "rust",
  "security",
  "smart-contract",
  "solana",
  "solidity",
  "sql",
  "tezos",
  "truffle",
  "typescript",
  "web3",
  "web3-py",
  "web3js",
  "zero-knowledge",
  "zk-snark",
] as const;

export const LEARN_CATEGORIES = [
  "all",
  ...LEARN_FORMATS,
  ...LEARN_LEVELS,
  ...LEARN_TOPICS,
] as const;

export type LearnFormat = (typeof LEARN_FORMATS)[number];
export type LearnLevel = (typeof LEARN_LEVELS)[number];
export type LearnTopic = (typeof LEARN_TOPICS)[number];
export type LearnCategory = (typeof LEARN_CATEGORIES)[number];

const LEARN_FORMAT_SET = new Set<string>(LEARN_FORMATS);
const LEARN_LEVEL_SET = new Set<string>(LEARN_LEVELS);
const LEARN_TOPIC_SET = new Set<string>(LEARN_TOPICS);
const LEARN_CATEGORY_SET = new Set<string>(LEARN_CATEGORIES);

export function isLearnFormat(slug: string): slug is LearnFormat {
  return LEARN_FORMAT_SET.has(slug);
}

export function isLearnLevel(slug: string): slug is LearnLevel {
  return LEARN_LEVEL_SET.has(slug);
}

export function isLearnTopic(slug: string): slug is LearnTopic {
  return LEARN_TOPIC_SET.has(slug);
}

export function isLearnCategory(slug: string): slug is LearnCategory {
  return LEARN_CATEGORY_SET.has(slug);
}

export type LearnFacetKey = "formats" | "levels" | "topics";

export const LEARN_FACETS: readonly {
  key: LearnFacetKey;
  label: string;
  slugs: readonly LearnCategory[];
}[] = [
  // "all" rides in the Formats row (not a fourth facet) so the pill bar
  // stays a browsable filter, not a table of contents, while still
  // reaching every slug in LEARN_CATEGORIES from a single row group.
  { key: "formats", label: "Formats", slugs: ["all", ...LEARN_FORMATS] },
  { key: "levels", label: "Levels", slugs: LEARN_LEVELS },
  { key: "topics", label: "Topics", slugs: LEARN_TOPICS },
];

const LEARN_FORMAT_LEVEL_LABELS: Record<string, string> = {
  all: "All formats",
  "open-source": "Open source",
};

const LEARN_TOPIC_LABELS: Record<LearnTopic, string> = {
  a16z: "a16z",
  ai: "AI",
  bitcoin: "Bitcoin",
  blockchain: "Blockchain",
  "blockchain-engineer": "Blockchain Engineer",
  btc: "BTC",
  "career-advice": "Career Advice",
  clojure: "Clojure",
  "community-manager": "Community Manager",
  "computer-science": "Computer Science",
  crypto: "Crypto",
  cryptography: "Cryptography",
  css: "CSS",
  dao: "DAO",
  dapp: "dApp",
  defi: "DeFi",
  discord: "Discord",
  eos: "EOS",
  erc: "ERC",
  "erc-20": "ERC-20",
  ethereum: "Ethereum",
  finance: "Finance",
  ganache: "Ganache",
  gpt: "GPT",
  hardhat: "Hardhat",
  hr: "HR",
  "interview-questions": "Interview Questions",
  java: "Java",
  javascript: "JavaScript",
  "machine-learning": "Machine Learning",
  nextjs: "Next.js",
  nft: "NFT",
  nlp: "NLP",
  node: "Node.js",
  "non-tech": "Non-tech",
  openzeppelin: "OpenZeppelin",
  php: "PHP",
  polygon: "Polygon",
  prompt: "Prompt Engineering",
  python: "Python",
  react: "React",
  recruiter: "Recruiter",
  remix: "Remix",
  ruby: "Ruby",
  rust: "Rust",
  security: "Security",
  "smart-contract": "Smart Contract",
  solana: "Solana",
  solidity: "Solidity",
  sql: "SQL",
  tezos: "Tezos",
  truffle: "Truffle",
  typescript: "TypeScript",
  web3: "Web3",
  "web3-py": "Web3.py",
  web3js: "Web3.js",
  "zero-knowledge": "Zero-Knowledge",
  "zk-snark": "zk-SNARK",
};

function titleCaseWords(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export function learnCategoryLabel(slug: string): string {
  if (slug in LEARN_FORMAT_LEVEL_LABELS) return LEARN_FORMAT_LEVEL_LABELS[slug]!;
  if (isLearnTopic(slug)) return LEARN_TOPIC_LABELS[slug];
  return titleCaseWords(slug);
}

export const LEARN_CATALOG_LINKS = [
  { href: "/solidity-jobs", label: "Solidity jobs" },
  { href: "/solana-jobs", label: "Solana jobs" },
  { href: "/rust-jobs", label: "Rust jobs" },
  { href: "/smart-contract-jobs", label: "Smart contract jobs" },
  { href: "/intern-jobs", label: "Intern jobs" },
  { href: "/entry-level-jobs", label: "Entry level jobs" },
] as const;

export type LearnJobLink = { href: string; label: string };

export function isLearnTopicJobTag(slug: string): boolean {
  return isLearnTopic(slug) && isJobTag(slug);
}

export function learnRelatedJobLinks(
  category: LearnCategory,
): readonly LearnJobLink[] {
  if (isLearnTopicJobTag(category)) {
    const label = learnCategoryLabel(category);
    return [
      { href: `/${category}-jobs`, label: `${label} jobs` },
      { href: `/remote-${category}-jobs`, label: `Remote ${label} jobs` },
    ];
  }
  return LEARN_CATALOG_LINKS;
}
