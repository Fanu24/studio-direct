import { FEATURED_TAG_CHIPS, isJobTag } from "@gaming/shared";

/**
 * Working /hire/{role} slugs that FEATURED_TAG_CHIPS leaves out. Kept here
 * rather than inside hire/page.tsx so the footer links the same vocabulary the
 * hub renders; otherwise these roles are reachable only by typing the URL.
 *
 * Every slug in this file must satisfy `isJobTag` - `/hire/[skill]` calls
 * notFound() on anything else - and HIRE_TAGS filters on that as a guard so a
 * taxonomy pass that drops a tag degrades to "the link disappears" instead of
 * "the hub links a 404".
 */
const EXTRA_HIRE_TAGS = [
  "android",
  "c-plus-plus",
  "copywriting",
  "dot-net",
  "event-manager",
  "flutter",
  "game-dev",
  "hr",
  "ios",
  "kyc",
  "legal",
  "men-in-web3",
  "others-in-web3",
  "php",
  "prompt",
  "python",
  "quality-assurance",
  "react-native",
  "recruiter",
  "scala",
  "security",
  "seo",
  "social-media",
  "ton-developer",
  "ux-researcher",
  "web3",
  "women-in-web3",
] as const;

/** Every role the /hire hub and the footer Hire group both link. */
export const HIRE_TAGS: readonly string[] = [
  ...new Set<string>([...FEATURED_TAG_CHIPS, ...EXTRA_HIRE_TAGS]),
].filter((slug) => isJobTag(slug));

/**
 * The hire hub's directory grouping. The reference IA this mirrors splits its
 * hire index into named bands rather than one flat alphabet, which is what
 * makes a ~75 entry list scannable; we keep the same bands and sort our own
 * taxonomy into them. `catchAll: true` marks the band that absorbs every
 * HIRE_TAGS slug not named in an earlier band, so adding a tag to the taxonomy
 * can never silently drop it out of the hub.
 */
export type HireGroup = {
  key: string;
  label: string;
  slugs: readonly string[];
};

const GROUP_DEFINITIONS: readonly {
  key: string;
  label: string;
  slugs?: readonly string[];
  catchAll?: true;
}[] = [
  {
    key: "web3-developers",
    label: "Web3 developers",
    slugs: [
      "blockchain",
      "smart-contract",
      "solidity",
      "solana",
      "rust",
      "web3",
      "ton-developer",
      "zero-knowledge",
      "evm",
      "layer-2",
      "hardhat",
      "truffle",
      "openzeppelin",
      "ganache",
      "web3js",
      "web3-py",
      "erc",
      "erc-20",
    ],
  },
  {
    key: "other-developers",
    label: "Other developers",
    slugs: [
      "android",
      "backend",
      "c-plus-plus",
      "cto",
      "dot-net",
      "flutter",
      "front-end",
      "full-stack",
      "game-dev",
      "golang",
      "ios",
      "java",
      "javascript",
      "mobile",
      "node",
      "php",
      "python",
      "react",
      "react-native",
      "ruby",
      "scala",
    ],
  },
  {
    key: "ai-engineers",
    label: "AI engineers",
    slugs: ["ai", "prompt"],
  },
  {
    key: "other-tech",
    label: "Other tech",
    slugs: [
      "analyst",
      "customer-support",
      "data-science",
      "design",
      "developer-relations",
      "devops",
      "event-manager",
      "product-manager",
      "project-manager",
      "quality-assurance",
      "research",
      "security",
      "ux-researcher",
    ],
  },
  {
    key: "non-tech",
    label: "Non-tech",
    slugs: [
      "community-manager",
      "copywriting",
      "economy-designer",
      "hr",
      "kyc",
      "legal",
      "marketing",
      "moderator",
      "non-tech",
      "recruiter",
      "sales",
      "seo",
      "social-media",
    ],
  },
  {
    key: "people-in-web3",
    label: "People in Web3",
    slugs: ["men-in-web3", "others-in-web3", "women-in-web3"],
  },
  {
    key: "more",
    label: "More to hire",
    catchAll: true,
  },
];

/** HIRE_TAGS split into the directory bands above, empty bands dropped. */
export function hireGroups(tags: readonly string[] = HIRE_TAGS): HireGroup[] {
  const available = new Set(tags);
  const claimed = new Set<string>();
  const groups: HireGroup[] = [];

  for (const definition of GROUP_DEFINITIONS) {
    const slugs = definition.catchAll
      ? tags.filter((slug) => !claimed.has(slug))
      : (definition.slugs ?? []).filter((slug) => available.has(slug));
    for (const slug of slugs) claimed.add(slug);
    if (slugs.length > 0) {
      groups.push({ key: definition.key, label: definition.label, slugs });
    }
  }

  return groups;
}
