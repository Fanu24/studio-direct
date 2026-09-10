import {
  LEARN_TOPICS,
  isLearnCategory,
  type LearnCategory,
  type LearnFormat,
  type LearnLevel,
  type LearnTopic,
} from "./categories";

/**
 * A curated learning resource. Every entry below points at a real, publicly
 * documented, official resource - a project's own docs site, a maintainer's
 * own repo, or a widely known publisher - checked against live search
 * results while this file was written. Nothing here is a scraped article
 * or a third-party "top 10 resources" listicle, and none of it carries an
 * invented price, rating, or student count (see the HONESTY RULE). `source`
 * names the publisher for attribution and doubles as the resource card's
 * text thumbnail; there is no fabricated cover image.
 *
 * Coverage is intentionally partial. Some topics (career-advice, hr,
 * recruiter, community-manager, non-tech, gpt, eos, truffle, ganache) have
 * no entries because no resource meeting the bar above exists for them yet
 * - the grid renders a truthful empty state for those rather than padding
 * the list. Truffle and Ganache are omitted on purpose: Consensys sunset
 * both toolkits in 2023 and archived their repos in 2024, so pointing
 * learners at them would be stale advice, not a resource.
 *
 * `slug` reserves the future /learn-web3/{slug} resource-detail route
 * (task 6 of P14): topic slugs and resource slugs will share that
 * namespace, so the eventual route does `isLearnTopic(slug) ??
 * findResourceBySlug(slug) ?? notFound()`. That route is not built yet;
 * this file only reserves stable, unique slugs for it.
 */
export interface LearnResource {
  slug: string;
  title: string;
  url: string;
  source: string;
  type: LearnFormat;
  level: LearnLevel;
  topics: LearnTopic[];
  summary: string;
}

export const LEARN_RESOURCES: readonly LearnResource[] = [
  {
    slug: "cryptozombies",
    title: "CryptoZombies",
    url: "https://cryptozombies.io/",
    source: "CryptoZombies",
    type: "tutorial",
    level: "beginner",
    topics: ["solidity", "smart-contract"],
    summary:
      "An interactive coding game that teaches Solidity by having you build a zombie-themed game contract step by step.",
  },
  {
    slug: "ethereum-org-developer-docs",
    title: "Ethereum Developer Docs",
    url: "https://ethereum.org/en/developers/docs/",
    source: "ethereum.org",
    type: "article",
    level: "beginner",
    topics: ["ethereum", "blockchain"],
    summary:
      "The Ethereum Foundation's own reference for how accounts, transactions, gas, and the EVM fit together.",
  },
  {
    slug: "ethereum-org-web3",
    title: "What is Web3?",
    url: "https://ethereum.org/en/web3/",
    source: "ethereum.org",
    type: "article",
    level: "beginner",
    topics: ["web3", "blockchain"],
    summary:
      "The Ethereum Foundation's plain-language explainer of what the term web3 is actually pointing at.",
  },
  {
    slug: "ethereum-org-nft",
    title: "Non-Fungible Tokens (NFTs)",
    url: "https://ethereum.org/en/nft/",
    source: "ethereum.org",
    type: "article",
    level: "beginner",
    topics: ["nft", "erc-20", "erc"],
    summary:
      "How NFTs work on Ethereum, the standards behind them, and where they show up outside of collectibles.",
  },
  {
    slug: "ethereum-org-dao",
    title: "Decentralized Autonomous Organisations (DAOs)",
    url: "https://ethereum.org/en/dao/",
    source: "ethereum.org",
    type: "article",
    level: "beginner",
    topics: ["dao"],
    summary:
      "What a DAO actually is on-chain, how proposals and voting work, and the tooling teams run them with.",
  },
  {
    slug: "ethereum-org-defi",
    title: "Decentralized Finance (DeFi)",
    url: "https://ethereum.org/en/defi/",
    source: "ethereum.org",
    type: "article",
    level: "beginner",
    topics: ["defi", "finance"],
    summary:
      "A tour of lending, exchanges, and yield products built on Ethereum without a central intermediary.",
  },
  {
    slug: "ethereum-org-dapps",
    title: "Decentralized Applications (dapps)",
    url: "https://ethereum.org/en/dapps/",
    source: "ethereum.org",
    type: "article",
    level: "beginner",
    topics: ["dapp"],
    summary:
      "What separates a dapp from a normal web app, and the front-end plus on-chain pieces that make one up.",
  },
  {
    slug: "ethereum-org-erc20",
    title: "ERC-20 Token Standard",
    url: "https://ethereum.org/en/developers/docs/standards/tokens/erc-20/",
    source: "ethereum.org",
    type: "article",
    level: "intermediate",
    topics: ["erc-20", "erc", "ethereum"],
    summary:
      "The interface every fungible Ethereum token still implements, explained with the actual function signatures.",
  },
  {
    slug: "ethereum-whitepaper",
    title: "Ethereum Whitepaper",
    url: "https://ethereum.org/en/whitepaper/",
    source: "ethereum.org",
    type: "whitepaper",
    level: "advanced",
    topics: ["ethereum", "blockchain"],
    summary:
      "Vitalik Buterin's original argument for a general-purpose, programmable blockchain, hosted by the Ethereum Foundation.",
  },
  {
    slug: "solidity-docs",
    title: "Solidity Documentation",
    url: "https://docs.soliditylang.org/",
    source: "soliditylang.org",
    type: "article",
    level: "intermediate",
    topics: ["solidity", "smart-contract"],
    summary:
      "The language's own reference for syntax, types, and the compiler behaviour every Solidity job assumes you know.",
  },
  {
    slug: "solidity-by-example",
    title: "Solidity by Example",
    url: "https://solidity-by-example.org/",
    source: "solidity-by-example.org",
    type: "tutorial",
    level: "beginner",
    topics: ["solidity", "smart-contract"],
    summary:
      "Short, runnable Solidity snippets organised by pattern, from a basic contract to reentrancy guards.",
  },
  {
    slug: "openzeppelin-contracts-docs",
    title: "OpenZeppelin Contracts",
    url: "https://docs.openzeppelin.com/contracts/",
    source: "OpenZeppelin",
    type: "article",
    level: "intermediate",
    topics: ["openzeppelin", "smart-contract", "solidity"],
    summary:
      "Documentation for the audited contract library most production Solidity teams build their own contracts on top of.",
  },
  {
    slug: "ethernaut",
    title: "Ethernaut",
    url: "https://ethernaut.openzeppelin.com/",
    source: "OpenZeppelin",
    type: "challenge",
    level: "intermediate",
    topics: ["solidity", "security", "smart-contract"],
    summary:
      "OpenZeppelin's wargame of intentionally vulnerable contracts you break into to learn how exploits actually work.",
  },
  {
    slug: "damn-vulnerable-defi",
    title: "Damn Vulnerable DeFi",
    url: "https://www.damnvulnerabledefi.xyz/",
    source: "Damn Vulnerable DeFi",
    type: "challenge",
    level: "advanced",
    topics: ["defi", "security", "solidity"],
    summary:
      "A set of hands-on DeFi exploit challenges covering flash loans, oracles, governance, and upgradeability bugs.",
  },
  {
    slug: "consensys-best-practices",
    title: "Smart Contract Best Practices",
    url: "https://consensys.github.io/smart-contract-best-practices/",
    source: "Consensys",
    type: "article",
    level: "intermediate",
    topics: ["security", "solidity", "smart-contract"],
    summary:
      "Consensys's living checklist of the recurring smart-contract bugs and the patterns that prevent them.",
  },
  {
    slug: "rareskills-solidity",
    title: "The Ultimate Solidity Course",
    url: "https://rareskills.io/learn-solidity",
    source: "RareSkills",
    type: "course",
    level: "intermediate",
    topics: ["solidity", "smart-contract"],
    summary:
      "A free, in-depth Solidity course aimed at developers who already know the basics and want production-level fluency.",
  },
  {
    slug: "hardhat-docs",
    title: "Hardhat Documentation",
    url: "https://hardhat.org/docs",
    source: "Hardhat",
    type: "article",
    level: "intermediate",
    topics: ["hardhat", "solidity"],
    summary:
      "Setup, testing, and deployment docs for the Ethereum development environment most Solidity jobs now expect.",
  },
  {
    slug: "foundry-book",
    title: "The Foundry Book",
    url: "https://book.getfoundry.sh/",
    source: "Foundry",
    type: "book",
    level: "intermediate",
    topics: ["solidity", "smart-contract"],
    summary:
      "The reference manual for Foundry's Forge, Cast, and Anvil tools, written by the Foundry maintainers.",
  },
  {
    slug: "remix-docs",
    title: "Remix IDE Documentation",
    url: "https://remix-ide.readthedocs.io/",
    source: "Remix",
    type: "article",
    level: "beginner",
    topics: ["remix", "solidity"],
    summary:
      "How to write, compile, and deploy a Solidity contract from the browser with no local toolchain to install.",
  },
  {
    slug: "solana-docs",
    title: "Solana Documentation",
    url: "https://solana.com/docs",
    source: "Solana",
    type: "article",
    level: "beginner",
    topics: ["solana"],
    summary:
      "Solana's own docs covering accounts, the runtime, and how to write and deploy your first on-chain program.",
  },
  {
    slug: "anchor-docs",
    title: "Anchor Framework Docs",
    url: "https://www.anchor-lang.com/docs",
    source: "Anchor",
    type: "article",
    level: "intermediate",
    topics: ["solana", "rust"],
    summary:
      "Reference docs for Anchor, the Rust framework most production Solana programs are written with.",
  },
  {
    slug: "solana-whitepaper",
    title: "Solana Whitepaper",
    url: "https://solana.com/solana-whitepaper.pdf",
    source: "Solana",
    type: "whitepaper",
    level: "advanced",
    topics: ["solana"],
    summary:
      "The original technical case for Solana's proof-of-history approach to high-throughput consensus.",
  },
  {
    slug: "solana-foundation-github",
    title: "Solana Foundation on GitHub",
    url: "https://github.com/solana-foundation",
    source: "GitHub",
    type: "open-source",
    level: "intermediate",
    topics: ["solana", "rust"],
    summary:
      "The Solana Foundation's public repositories - a real place to read production Rust and open a first pull request.",
  },
  {
    slug: "rust-book",
    title: "The Rust Programming Language",
    url: "https://doc.rust-lang.org/book/",
    source: "Rust",
    type: "book",
    level: "beginner",
    topics: ["rust"],
    summary:
      "The official Rust book, and still the most common on-ramp into the language behind Solana and other chains.",
  },
  {
    slug: "bitcoin-whitepaper",
    title: "Bitcoin: A Peer-to-Peer Electronic Cash System",
    url: "https://bitcoin.org/bitcoin.pdf",
    source: "bitcoin.org",
    type: "whitepaper",
    level: "advanced",
    topics: ["bitcoin", "btc", "cryptography"],
    summary:
      "Satoshi Nakamoto's original paper, hosted at the project's own domain, describing proof-of-work consensus.",
  },
  {
    slug: "bitcoin-developer-guide",
    title: "Bitcoin Developer Guide",
    url: "https://developer.bitcoin.org/",
    source: "developer.bitcoin.org",
    type: "article",
    level: "intermediate",
    topics: ["bitcoin", "btc"],
    summary:
      "Reference documentation for Bitcoin's peer-to-peer protocol, scripting system, and wallet formats.",
  },
  {
    slug: "mastering-bitcoin",
    title: "Mastering Bitcoin (free edition)",
    url: "https://github.com/bitcoinbook/bitcoinbook",
    source: "GitHub",
    type: "book",
    level: "advanced",
    topics: ["bitcoin", "btc", "cryptography"],
    summary:
      "Andreas Antonopoulos's technical book on Bitcoin internals, published free and open source on GitHub.",
  },
  {
    slug: "mastering-ethereum",
    title: "Mastering Ethereum (free edition)",
    url: "https://github.com/ethereumbook/ethereumbook",
    source: "GitHub",
    type: "book",
    level: "advanced",
    topics: ["ethereum", "smart-contract"],
    summary:
      "The companion book to Mastering Bitcoin, covering the EVM, contracts, and Ethereum client internals.",
  },
  {
    slug: "zk-learning",
    title: "ZK Learning: Foundations of Zero Knowledge",
    url: "https://zk-learning.org/",
    source: "zk-learning.org",
    type: "course",
    level: "advanced",
    topics: ["zero-knowledge", "zk-snark", "cryptography"],
    summary:
      "A university-taught MOOC on zero-knowledge proofs, from the researchers who helped design SNARK systems.",
  },
  {
    slug: "chainlink-docs",
    title: "Chainlink Documentation",
    url: "https://docs.chain.link/",
    source: "Chainlink",
    type: "article",
    level: "intermediate",
    topics: ["smart-contract", "blockchain", "defi"],
    summary:
      "Docs for the oracle network most DeFi and cross-chain contracts use to reach real-world data on-chain.",
  },
  {
    slug: "polygon-docs",
    title: "Polygon Developer Docs",
    url: "https://docs.polygon.technology/",
    source: "Polygon",
    type: "article",
    level: "intermediate",
    topics: ["polygon", "ethereum"],
    summary:
      "Official documentation for building on Polygon's chains, from PoS to the CDK and Agglayer stack.",
  },
  {
    slug: "tezos-docs",
    title: "Tezos Documentation",
    url: "https://docs.tezos.com/",
    source: "Tezos",
    type: "article",
    level: "intermediate",
    topics: ["tezos"],
    summary:
      "The Tezos Foundation's docs on the protocol's on-chain governance and how to write and deploy contracts.",
  },
  {
    slug: "web3py-docs",
    title: "web3.py Documentation",
    url: "https://web3py.readthedocs.io/",
    source: "web3.py",
    type: "article",
    level: "intermediate",
    topics: ["web3-py", "python", "ethereum"],
    summary:
      "Reference docs for the Python library most backend services use to talk to Ethereum nodes and contracts.",
  },
  {
    slug: "discord-developer-docs",
    title: "Discord Developer Documentation",
    url: "https://discord.com/developers/docs/intro",
    source: "Discord",
    type: "article",
    level: "intermediate",
    topics: ["discord"],
    summary:
      "Docs for building bots and integrations on the chat platform most Web3 teams and communities run on daily.",
  },
  {
    slug: "nextjs-docs",
    title: "Next.js Documentation",
    url: "https://nextjs.org/docs",
    source: "Next.js",
    type: "article",
    level: "beginner",
    topics: ["nextjs", "react", "javascript", "typescript"],
    summary:
      "Vercel's official Next.js docs, the React framework most modern dapp front ends are shipped with.",
  },
  {
    slug: "react-dev",
    title: "react.dev",
    url: "https://react.dev/learn",
    source: "React",
    type: "article",
    level: "beginner",
    topics: ["react", "javascript"],
    summary:
      "The React team's own guide to components, state, and hooks - the base most dapp UIs are built from.",
  },
  {
    slug: "typescript-handbook",
    title: "The TypeScript Handbook",
    url: "https://www.typescriptlang.org/docs/handbook/intro.html",
    source: "TypeScript",
    type: "article",
    level: "beginner",
    topics: ["typescript", "javascript"],
    summary:
      "Microsoft's official TypeScript handbook, covering the type system most Web3 front-end and tooling code uses.",
  },
  {
    slug: "nodejs-docs",
    title: "Node.js Documentation",
    url: "https://nodejs.org/en/docs",
    source: "Node.js",
    type: "article",
    level: "beginner",
    topics: ["node", "javascript"],
    summary:
      "Official Node.js docs for the runtime behind most indexers, bots, and backend services around a chain.",
  },
  {
    slug: "mdn-css",
    title: "CSS on MDN",
    url: "https://developer.mozilla.org/en-US/docs/Web/CSS",
    source: "MDN Web Docs",
    type: "article",
    level: "beginner",
    topics: ["css"],
    summary:
      "Mozilla's reference for the styling language behind every dapp front end, kept current with browser support notes.",
  },
  {
    slug: "python-tutorial",
    title: "The Python Tutorial",
    url: "https://docs.python.org/3/tutorial/",
    source: "Python",
    type: "article",
    level: "beginner",
    topics: ["python"],
    summary:
      "The official Python docs' own tutorial, a common starting point before scripting against a chain with web3.py.",
  },
  {
    slug: "oracle-java-tutorials",
    title: "The Java Tutorials",
    url: "https://docs.oracle.com/javase/tutorial/",
    source: "Oracle",
    type: "article",
    level: "beginner",
    topics: ["java"],
    summary:
      "Oracle's own Java tutorials, still the reference point for the JVM tooling used in some enterprise chain integrations.",
  },
  {
    slug: "php-manual",
    title: "PHP Manual",
    url: "https://www.php.net/manual/en/",
    source: "PHP",
    type: "article",
    level: "beginner",
    topics: ["php"],
    summary:
      "The official PHP language reference, still relevant for backend and admin tooling around some crypto platforms.",
  },
  {
    slug: "ruby-docs",
    title: "Ruby Documentation",
    url: "https://www.ruby-lang.org/en/documentation/",
    source: "ruby-lang.org",
    type: "article",
    level: "beginner",
    topics: ["ruby"],
    summary:
      "The Ruby project's own documentation hub, covering the language used in some Web3 backend tooling.",
  },
  {
    slug: "sqlbolt",
    title: "SQLBolt",
    url: "https://sqlbolt.com/",
    source: "SQLBolt",
    type: "tutorial",
    level: "beginner",
    topics: ["sql"],
    summary:
      "A free, interactive set of SQL lessons useful for querying indexed on-chain and backend job data.",
  },
  {
    slug: "clojure-getting-started",
    title: "Getting Started with Clojure",
    url: "https://clojure.org/guides/getting_started",
    source: "Clojure",
    type: "article",
    level: "beginner",
    topics: ["clojure"],
    summary:
      "The Clojure project's own setup and language guide, for the Lisp occasionally used in chain tooling.",
  },
  {
    slug: "cs50",
    title: "CS50: Introduction to Computer Science",
    url: "https://cs50.harvard.edu/x/",
    source: "Harvard CS50",
    type: "course",
    level: "beginner",
    topics: ["computer-science"],
    summary:
      "Harvard's free introductory computer science course covering the data structures and algorithms fundamentals.",
  },
  {
    slug: "openai-platform-docs",
    title: "OpenAI Platform Documentation",
    url: "https://platform.openai.com/docs",
    source: "OpenAI",
    type: "article",
    level: "intermediate",
    topics: ["gpt", "ai", "prompt"],
    summary:
      "Reference docs for building against GPT models - the tooling behind most AI copilots and chat features.",
  },
  {
    slug: "prompting-guide",
    title: "Prompt Engineering Guide",
    url: "https://www.promptingguide.ai/",
    source: "promptingguide.ai",
    type: "article",
    level: "beginner",
    topics: ["prompt", "ai", "gpt"],
    summary:
      "A structured, actively maintained guide to prompting techniques for large language models.",
  },
  {
    slug: "deeplearning-ai-short-courses",
    title: "DeepLearning.AI Short Courses",
    url: "https://www.deeplearning.ai/short-courses/",
    source: "DeepLearning.AI",
    type: "course",
    level: "beginner",
    topics: ["ai", "machine-learning", "nlp"],
    summary:
      "Andrew Ng's DeepLearning.AI publishes free, short, hands-on courses on modern AI and machine-learning tooling.",
  },
  {
    slug: "coursera-machine-learning",
    title: "Machine Learning Specialization",
    url: "https://www.coursera.org/learn/machine-learning",
    source: "Coursera",
    type: "course",
    level: "intermediate",
    topics: ["machine-learning"],
    summary:
      "Andrew Ng's widely referenced machine-learning course, useful for teams applying ML to on-chain data or fraud detection.",
  },
  {
    slug: "a16z-crypto",
    title: "a16z crypto",
    url: "https://a16zcrypto.com/",
    source: "a16z crypto",
    type: "article",
    level: "intermediate",
    topics: ["a16z", "crypto", "defi"],
    summary:
      "Research and market commentary from a16z's crypto arm, whose language shows up often in hiring posts.",
  },
  {
    slug: "investopedia-cryptocurrency",
    title: "Cryptocurrency Explained",
    url: "https://www.investopedia.com/cryptocurrency-4427699",
    source: "Investopedia",
    type: "article",
    level: "beginner",
    topics: ["finance", "crypto"],
    summary:
      "Investopedia's plain-language hub for how cryptocurrency fits into traditional finance concepts.",
  },
  {
    slug: "coindesk",
    title: "CoinDesk",
    url: "https://www.coindesk.com/",
    source: "CoinDesk",
    type: "news",
    level: "beginner",
    topics: ["crypto"],
    summary:
      "A long-running crypto news outlet, useful for a fast daily pass rather than as a study plan.",
  },
  {
    slug: "the-block",
    title: "The Block",
    url: "https://www.theblock.co/",
    source: "The Block",
    type: "news",
    level: "intermediate",
    topics: ["crypto", "defi"],
    summary:
      "Crypto-industry news and research with more depth on protocol and market-structure stories.",
  },
  {
    slug: "freecodecamp-youtube",
    title: "freeCodeCamp.org (YouTube)",
    url: "https://www.youtube.com/@freecodecamp",
    source: "freeCodeCamp",
    type: "video",
    level: "beginner",
    topics: ["javascript", "solidity", "blockchain"],
    summary:
      "freeCodeCamp's YouTube channel publishes long, free full-course videos, including blockchain and Solidity walkthroughs.",
  },
  {
    slug: "finematics-youtube",
    title: "Finematics (YouTube)",
    url: "https://www.youtube.com/@Finematics",
    source: "Finematics",
    type: "video",
    level: "intermediate",
    topics: ["defi", "crypto"],
    summary:
      "A YouTube channel that explains individual DeFi protocols and mechanisms with diagrams rather than hype.",
  },
  {
    slug: "whiteboard-crypto-youtube",
    title: "Whiteboard Crypto (YouTube)",
    url: "https://www.youtube.com/@WhiteboardCrypto",
    source: "Whiteboard Crypto",
    type: "video",
    level: "beginner",
    topics: ["crypto", "blockchain"],
    summary:
      "Whiteboard-style explainer videos that walk through blockchain and crypto concepts from first principles.",
  },
  {
    slug: "freecodecamp-org",
    title: "freeCodeCamp",
    url: "https://www.freecodecamp.org/",
    source: "freeCodeCamp",
    type: "course",
    level: "beginner",
    topics: ["javascript", "python", "computer-science"],
    summary:
      "A free, project-based curriculum covering web development and programming fundamentals from zero.",
  },
  {
    slug: "learnweb3",
    title: "LearnWeb3",
    url: "https://learnweb3.io/",
    source: "LearnWeb3",
    type: "course",
    level: "beginner",
    topics: ["web3", "blockchain", "solidity"],
    summary:
      "A free, community-run Web3 curriculum covering blockchain fundamentals, DeFi, and NFTs in short guided courses.",
  },
  {
    slug: "alchemy-university",
    title: "Alchemy University",
    url: "https://university.alchemy.com/",
    source: "Alchemy",
    type: "course",
    level: "beginner",
    topics: ["blockchain", "solidity", "ethereum"],
    summary:
      "Free, project-based Web3 courses run by Alchemy, covering Ethereum development from first principles.",
  },
  {
    slug: "openzeppelin-github",
    title: "OpenZeppelin on GitHub",
    url: "https://github.com/OpenZeppelin",
    source: "GitHub",
    type: "open-source",
    level: "intermediate",
    topics: ["openzeppelin", "security", "solidity"],
    summary:
      "OpenZeppelin's public repositories, including its audited contracts library, open for issues and contributions.",
  },
  {
    slug: "ethereum-github",
    title: "Ethereum on GitHub",
    url: "https://github.com/ethereum",
    source: "GitHub",
    type: "open-source",
    level: "intermediate",
    topics: ["ethereum", "smart-contract"],
    summary:
      "The Ethereum Foundation's public organisation, home to client implementations and protocol specifications.",
  },
] as const;

function assertUniqueSlugs() {
  const seen = new Set<string>();
  for (const resource of LEARN_RESOURCES) {
    if (seen.has(resource.slug)) {
      throw new Error(`Duplicate learn resource slug: ${resource.slug}`);
    }
    seen.add(resource.slug);
  }
}
assertUniqueSlugs();

export function resourcesForCategory(
  category: LearnCategory,
): readonly LearnResource[] {
  if (category === "all") return LEARN_RESOURCES;
  return LEARN_RESOURCES.filter(
    (resource) =>
      resource.type === category ||
      resource.level === category ||
      resource.topics.includes(category as LearnTopic),
  );
}

export function resourceCountForCategory(category: LearnCategory): number {
  return resourcesForCategory(category).length;
}

/**
 * Every topic slug currently backed by at least one curated resource -
 * used to keep test coverage honest about which topics ship a real grid
 * versus an empty state.
 */
export const LEARN_TOPICS_WITH_RESOURCES: readonly LearnTopic[] = LEARN_TOPICS.filter(
  (topic) => resourceCountForCategory(topic) > 0,
);

export function findResourceBySlug(slug: string): LearnResource | undefined {
  if (isLearnCategory(slug)) return undefined;
  return LEARN_RESOURCES.find((resource) => resource.slug === slug);
}
