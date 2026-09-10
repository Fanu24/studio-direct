import type { LandingKind } from "../landings.ts";
import {
  isBenefitSlug,
  isCitySlug,
  isCountrySlug,
  isRegionSlug,
  tagLabel,
} from "../taxonomy.ts";

export type RoleFaq = {
  question: string;
  answer: string;
};

export type LandingRoleFaqStats = {
  total: number;
  salaryRange?: string | null;
};

const NON_DEV_TAGS = new Set([
  "analyst",
  "community-manager",
  "cto",
  "customer-support",
  "dao",
  "design",
  "discord",
  "economy-designer",
  "entry-level",
  "intern",
  "marketing",
  "moderator",
  "non-tech",
  "pay-in-crypto",
  "product-manager",
  "project-manager",
  "research",
  "sales",
]);

const BLURBS: Record<string, RoleFaq> = {
  ai: {
    question: "What does an AI developer do?",
    answer:
      "An AI developer on Nodework sits where machine learning meets a crypto product, not in a generic chatbot factory. The work is usually a model, a retrieval pipeline, or an agent that has to call a wallet, a risk engine, or an indexer without inventing balances. You might train or fine-tune models on on-chain features, ship evaluation harnesses for market text, or put a constrained assistant in a support or trading workflow. Production matters more than a demo notebook: latency, prompt injection, and the fact that a wrong answer next to a withdraw button is a safety bug. Listings name Python or TypeScript, the data source, and whether you own inference cost. Some seats are research-heavy. Others are product engineers who know enough ML to ship. Remote and onsite both appear. Read the posting for whether the model touches custody, whether evaluations are required, and which chain the features come from. Nodework does not rank model quality. It lists the jobs teams tagged AI so you can open one and apply on this site.",
  },
  analyst: {
    question: "What does a Web3 analyst do?",
    answer:
      "A Web3 analyst on Nodework turns messy ledger and product data into something a team can act on. That is not the same as writing production contracts. You might build dashboards for protocol usage, watch liquidity and liquidation risk, size a market, or brief leadership before a listing or a partnership. Tools vary: SQL, Python, spreadsheet models, Dune-style query work, and internal warehouses fed by indexers. The hard part is definitions. TVL, active addresses, and volume can be gamed, so a good analyst documents the grain of every metric and refuses a vanity chart. Listings say whether the seat is research, finance, operations, or on-chain investigation. Some want a trading background. Others want a product analyst who can sit with engineering. Compensation bands appear when the employer printed them. Remote is common. Nodework tags the role so you can filter it. The description still tells you the dataset, the audience for the work, and whether you will present to a DAO, a fund, or a product org. Apply from the job page.",
  },
  backend: {
    question: "What does a backend developer do?",
    answer:
      "A backend developer on Nodework owns the services that sit between a wallet-facing client and the chain, an indexer, or a conventional database. Typical work includes APIs for balances and history, job queues for retries when a node lies, webhooks for deposit detection, and the auth story around session keys or SIWE. You will think about idempotency, reorgs, rate limits, and how to explain a failed broadcast without leaking secrets. Languages in listings cluster around TypeScript, Go, Rust, and Python. The interesting part is reliability: RPC providers fail, logs arrive late, and a double credit is a money bug. Teams hire this role when the dapp is more than a static ABI wrapper. Read each job for cloud, custody boundaries, and whether you also run workers that submit transactions. Seniority ranges from people who have shipped one production API to leads who set the service map. Remote and onsite both show up. Nodework keeps apply on this site. The stack is in the posting, not in the URL.",
  },
  bitcoin: {
    question: "What does a Bitcoin developer do?",
    answer:
      "A Bitcoin developer on Nodework works on software that speaks Bitcoin's UTXO model rather than an account chain with a general-purpose VM. That can mean wallet and PSBT flows, Lightning, indexing, ordinals or inscriptions products, side systems, or the operational work of running reliable nodes. You reason about fees, confirmation policy, script, and the difference between a mempool suggestion and a settled output. Some listings are protocol-adjacent C or Rust. Others are application engineers adding Bitcoin rails to an exchange or custody stack. Security is not a slogan: an off-by-one in change output handling is a loss. Read the job for whether you touch keys, whether you need Lightning experience, and whether the product is self-custody or hosted. Remote seats are common because the ecosystem is geographically wide. Nodework imports these as Bitcoin-tagged roles. The description is the source of truth for language, on-call, and whether you will work on consensus code or on a product that merely settles in BTC. Apply from the listing.",
  },
  blockchain: {
    question: "What does a blockchain developer do?",
    answer:
      "A blockchain developer on Nodework is a wide hiring tag for people who build or operate ledger-backed systems. Some listings mean protocol work: clients, networking, consensus, or execution. Others mean application work: contracts, indexers, and the services that make a chain usable. The shared skill is being able to explain how state is replicated, how forks are handled, and where trust still sits (bridges, sequencers, custodians, oracles). You will see Ethereum, Bitcoin, Solana, and newer networks in the same chip because employers use the word loosely. That is why the description matters more than the tag. Look for the client, the language, and whether the role is research, infrastructure, or product. Nodework does not collapse those into one seniority. Junior blockchain titles still need a stack. Staff titles still need a product. Remote and geo landings both exist. Open the job for on-call expectations around nodes and for whether you will write Go, Rust, Solidity, or TypeScript. Then apply on this site.",
  },
  "community-manager": {
    question: "What does a Web3 community manager do?",
    answer:
      "A community manager on Nodework is not a developer title. The job is to keep a living channel honest: Discord or Telegram, governance forums, AMAs, and the messy middle between users and the team. You set norms, escalate scams, schedule programs, and translate engineering timelines into language people can use without promising a token price. Good operators write clearly, document decisions, and know when to stop a rumor. Listings name the product, the time zone coverage, and whether you also own moderation hiring or only the calendar. Some seats sit next to marketing. Others sit next to support and trust and safety. You will handle wallets, claims, and angry users when a mint goes wrong. That is operations, not growth theater. Nodework lists these roles because crypto products fail in public. Read the posting for languages, night coverage, and whether the community is a DAO, a game, or a protocol. Compensation may be cash, tokens, or both. Apply on the job page. Do not treat a community tag as an engineering filter.",
  },
  crypto: {
    question: "What does a crypto developer do?",
    answer:
      "A crypto developer on Nodework is usually an engineer at a company that moves, stores, or reports on digital assets. That includes exchanges, custody, payments, on-ramps, and market-structure tools as much as it includes greenfield protocols. The work can be matching engines, deposit sweeps, proof-of-reserves pipelines, or wallet integrations that must not mis-credit a chain reorg. You will hear about hot and cold wallets, travel-rule vendors, and the difference between a chain integration and a marketing partnership. Languages follow the firm: Java, Go, Rust, TypeScript, or Python. Compliance is part of the design, not an afterthought, because these products sit next to real money. Listings tagged crypto are broader than a single VM. Read each job for the asset list, the custody model, and whether you will be on-call for deposits. Remote and onsite both appear, often in financial centers. Nodework is a catalog, not an exchange. Open the role, check the stack, and apply here if it matches the work you can actually do.",
  },
  cryptography: {
    question: "What does a cryptography developer do?",
    answer:
      "A cryptography developer on Nodework works on the math and implementations that make keys, proofs, and protocols safe to ship. That is a narrower job than a general blockchain title. You might implement signature schemes, review a custom protocol, build a threshold wallet, or take a proving system from a paper to something other engineers can call. The bar is correctness under a threat model: side channels, nonce reuse, trusted setup assumptions, and the gap between a proof in a slide and a library other people will misuse. Listings often want a research background plus production judgment. Languages include Rust, C, Go, and sometimes Circom or other DSL work for circuits. You will write tests that look like attacks. You will say no to rolling your own when a standard exists. Nodework tags these roles so specialists can find them. Read the posting for whether the seat is applied crypto on a product, protocol research, or audit-adjacent work. Remote is common. Apply on this site. Do not confuse this tag with a marketing use of the word crypto.",
  },
  cto: {
    question: "What does a Web3 CTO do?",
    answer:
      "A Web3 CTO on Nodework is an executive engineering seat, not a senior developer with a louder title. You own architecture, hiring, vendor risk, and the story the board hears when a chain, a bridge, or a custodial partner fails. Day to day that means choosing which work is protocol versus application, setting review bars for anything that can move funds, and making sure incident response exists before the first war room. You will talk to product, legal, and sometimes a DAO, and you will be the person who kills a rushed mainnet date. Listings at this level expect you to have shipped teams, not only repos. Some startups want a player-coach who still reviews Solidity. Later-stage firms want someone who can run managers and a security program. Nodework will show location, remote policy, and any published pay band. It will not replace diligence on token allocation or runway. Read the company, the stack, and whether the CTO still writes code. Then apply from the listing if that is the job you actually want.",
  },
  "customer-support": {
    question: "What does Web3 customer support do?",
    answer:
      "Customer support on Nodework is a non-engineering role that still has to be precise around money. You help users recover from failed transactions, explain seed phrases without ever asking for them, walk through KYC, and escalate when an incident is bigger than one ticket. The quality bar is documentation and calm: a wrong answer about a withdraw delay becomes a trust event. Tools are the usual stack (Zendesk-class queues, macros, status pages) plus chain explorers and internal admin tools that must be permissioned. Listings say which product you cover (exchange, wallet, NFT, game) and which hours. Some seats are 24/7 with follow-the-sun. Others are specialist queues for payments or institutions. You are not a moderator and you are not a community manager, though the three collaborate when scams spike. Nodework lists these jobs because crypto products generate support load even when engineering is quiet. Read the posting for language requirements and whether you will have any admin power over balances. Apply on this site. Never use a support tag as a back door into an engineering title.",
  },
  dao: {
    question: "What does DAO work look like?",
    answer:
      "DAO-tagged roles on Nodework sit next to on-chain governance, treasuries, and contributor operations. The work is mixed. Some listings are engineers building voting, execution, and indexing for proposals. Others are operators who run forums, pay contributors, and keep a calendar of votes without pretending a token holder chat is a legal entity. You will deal with messy ownership: multisigs, delegates, service providers, and the gap between a passed proposal and a shipped diff. Writing clearly matters as much as tooling. A good DAO operator documents what the treasury can actually spend. A good DAO engineer makes execution boring. Listings name whether you are ops, product, or protocol, and whether the DAO is the employer or the customer. Compensation might be a stream, a grant, or a conventional salary. Nodework does not certify decentralization. It lists jobs people tagged DAO. Read the description for decision rights, time zones, and whether you will hold keys. Then apply on this site if the scope matches how you already work.",
  },
  "data-science": {
    question: "What does a data science developer do?",
    answer:
      "A data science role on Nodework applies statistics and modeling to crypto and product datasets, not just to a generic warehouse. You might cluster addresses, forecast usage, detect wash trading, or build features for a risk model that a trading or lending desk will actually run. The craft is the same as elsewhere (experiment design, leakage, baselines) with extra ways to fool yourself: sybil activity, MEV-shaped outliers, and labels that come from a single indexer. Python is the usual language. SQL is not optional. Some listings want production ML. Others want an analyst who can write a model without calling it AI. You will spend time on data quality and on explaining uncertainty to people who want a single number. Read the job for whether you sit in research, trading, or product, and for whether models ever touch custody. Nodework tags the skill so you can filter. It does not host notebooks. Open the listing for the stack, the seniority, and the apply path, which stays on this site.",
  },
  defi: {
    question: "What does a DeFi developer do?",
    answer:
      "A DeFi developer on Nodework builds or maintains software for on-chain markets: AMMs, lending, perps, structured products, or the oracles and keepers those systems need. The job is part protocol design and part production engineering. You think about solvency, liquidations, MEV, upgrade keys, and what happens when a dependency pauses. Solidity and EVM work is common. Solana and other VMs appear too. Testing is not a courtesy. Fork tests, invariant tests, and a plan for incident response are how teams survive. Listings also exist for off-chain keepers, risk dashboards, and front-ends that must not mis-display a position. Read each job for the chain, whether the code is upgradeable, and whether an audit is in flight. Nodework will not score protocol risk for you. It will show roles tagged DeFi so you can open the ones whose description you understand. Remote is frequent. Pay bands appear when printed. Apply from the job page, and treat admin-key scope as part of the interview, not a footnote.",
  },
  design: {
    question: "What does a Web3 designer do?",
    answer:
      "A designer on Nodework is a non-engineering role. You shape how a crypto product feels when money, keys, and irreversible actions are on the screen. That includes product design for wallet connect, transaction review, and empty states, plus visual systems for a brand that has to look trustworthy at a glance. The craft is still IA, type, components, and research. The extra constraint is honesty: a pretty confirm button that hides a spend limit is a failure. Listings may say product designer, brand, or motion. Some want Figma fluency and a taste for dense financial UI. Others want marketing design for launches. You will partner with front-end engineers, not replace them. Nodework lists design next to Solidity because the same companies hire both. Read the posting for whether you own research, whether you will sit in a game or a wallet, and whether the file is a full-time seat or a sprint. Apply on this site. Do not treat a design landing as a developer feed.",
  },
  "developer-relations": {
    question: "What does a developer relations role do?",
    answer:
      "Developer relations on Nodework sits between a platform and the people who build on it. You write docs that compile, ship examples, give talks, collect feedback, and sometimes maintain an SDK. The job is technical enough that you can open a PR, and public enough that you can explain a breaking change without spinning. Success looks like other teams shipping against your chain, your API, or your contracts, not like a vanity follower count. Listings name the product (L1, L2, wallet, indexer) and whether you travel. Some seats are almost engineering. Others are almost community. You will need a stack: Solidity, TypeScript, Rust, or whatever the ecosystem actually uses. Nodework tags DevRel so it is findable next to protocol jobs. Read the description for on-call during incidents, for sample code ownership, and for whether you are measured on integrations. Remote is common. Apply from the listing. This is not a support queue and it is not a pure marketing title, even when those teams share a calendar.",
  },
  devops: {
    question: "What does a DevOps developer do?",
    answer:
      "A DevOps or platform engineer on Nodework keeps Web3 software runnable: CI for contract tests, environments for forks, Kubernetes or the equivalent for APIs, and the observability that tells you an RPC fleet is lying. Crypto adds extra texture. You may run validators, manage key ceremonies with other people in the loop, pin builds for reproducible deploys, and treat secrets as a production incident class. Listings mix SRE, DevOps, and platform titles. Tools include Terraform, Grafana-class stacks, GitHub Actions, and whatever the team uses to talk to nodes. The job is not \"click deploy on a dapp.\" It is making deploys boring and rollbacks possible when a release notes file is not enough. Read the posting for on-call, for whether you touch validator keys, and for cloud versus colo. Nodework lists these as DevOps-tagged roles. Seniority varies from people who have automated one pipeline to leads who own a multi-region story. Apply on this site after you confirm the pager and the stack match how you already work.",
  },
  discord: {
    question: "What does a Discord role do in Web3?",
    answer:
      "Discord-tagged jobs on Nodework are usually community, moderation, or tooling seats around the server where a crypto product actually lives. Some listings are operators who set roles, run AMAs, and stop raid-and-scam patterns. Others are engineers writing bots, verification gates, and ticket routers that must not leak wallet data. The shared context is that Discord is where users hear about incidents first, so silence is a product decision. You will need written judgment and, for bot work, a normal software stack (often TypeScript or Python) plus an understanding of rate limits and privileged intents. This is not a developer title by default. Many postings are non-tech. Read the job for whether you write code, whether you moderate, and which hours you cover. Nodework keeps the tag because employers use it as a hiring chip. Apply from the listing. Do not assume a Discord URL is an engineering ladder, and do not assume a bot role is only emoji work. The description has the scope.",
  },
  "economy-designer": {
    question: "What does an economy designer do?",
    answer:
      "An economy designer on Nodework is a non-engineering specialist who shapes incentives in a game, a protocol, or a marketplace. You model sources and sinks, simulate how a token or an in-world currency will be farmed, and argue against levers that look good in a spreadsheet and break in week two. The work sits next to product, research, and sometimes token design, but it is not the same as writing Solidity. You need enough math to be honest about supply, enough product sense to know players will optimize the ugly path, and enough communication to explain tradeoffs to a founder who wants a number to go up. Listings appear most often around games and points programs. Read the posting for whether you own live-ops knobs, whether a token exists yet, and whether you will partner with data science. Nodework lists the tag because it is a real hiring chip, not because every Web3 product needs a token. Apply on this site if you already do this craft. Do not treat it as a back door into a protocol engineering seat.",
  },
  "entry-level": {
    question: "What does an entry level Web3 job look like?",
    answer:
      "Entry level Web3 jobs on Nodework are imported listings tagged for people early in their careers. The function still varies: junior engineering, support, community, research, or operations. What they share is a narrower scope, more supervision, and a description that should name the stack or the queue you will learn. These are not internships by default. Intern landings are separate. An entry-level engineer might write tests, ship a small API, or maintain docs. An entry-level non-tech hire might own a ticket queue or a content calendar with review. You should still expect to read, ask, and show work. Listings that only say Web3 without a craft are a weak signal. Prefer posts that name a language, a product, or a mentor structure. Nodework does not run a trainee academy. It collects the jobs employers marked entry-level so you can browse them in one place. Remote and onsite both appear. Read duration, pay, and location on each card, then apply on this site. A junior title is still a real job with production consequences when funds are involved.",
  },
  erc: {
    question: "What does an ERC developer do?",
    answer:
      "An ERC-tagged developer on Nodework works with Ethereum request-for-comment standards: the interfaces wallets and contracts use to interoperate. That usually means tokens, NFTs, permit flows, or newer standards the listing names. You implement, extend, or integrate those interfaces in Solidity, write tests against the spec, and watch for the ways a slightly wrong return value breaks a downstream protocol. The job is standards literacy plus production care. You will read EIPs, follow Safe or wallet behavior, and know when a custom extension will strand users. Some seats are protocol engineers. Others are application engineers adding an ERC to a product. Audits and existing libraries (including OpenZeppelin) show up often because rolling a token by hand is how teams get hurt. Read the posting for the standard, the chain (mainnet or L2), and whether you own the upgrade path. Nodework uses ERC as a filter chip. The description still has to say which interface and which language. Apply from the job page after you confirm that match.",
  },
  "erc-20": {
    question: "What does an ERC-20 developer do?",
    answer:
      "An ERC-20 developer on Nodework works specifically on fungible token contracts and the product around them. That includes implementing or integrating the ERC-20 interface, allowances, decimals, mint and burn roles, and the ways a token is listed, bridged, or used as collateral. The easy tutorial is not the job. Production work is about admin keys, fee-on-transfer surprises, permit variants, and making sure a front-end never shows a balance the contract will not honor. You will write Solidity tests, fork mainnet when integrations matter, and coordinate with wallets and exchanges that are picky about metadata. Some listings are protocol. Others are application engineers shipping a token as part of a larger product. Security review is part of the culture even when the employer has not booked an audit yet. Read the job for upgradeability, for whether you touch distribution, and for the chain. Nodework tags ERC-20 so this slice is browseable. Apply on this site. Treat every allowance UX as a safety surface.",
  },
  evm: {
    question: "What does an EVM developer do?",
    answer:
      "An EVM developer on Nodework builds for Ethereum's execution model and for the networks that reuse it. You think in accounts, calldata, gas, storage slots, and logs. The work might be Solidity contracts, a client or tracer in Go, an indexer that decodes traces, or tooling that simulates transactions before a wallet signs. L2s are in scope when they are EVM-equivalent enough that the same mental model holds, plus the extra bridge and sequencer caveats. Listings use this tag when they care about opcode-level fluency, not only about a framework name. You should be comfortable reading a trace, explaining why a tx reverted, and knowing what CREATE2 and delegatecall are for. Read the posting for Solidity versus client work, for mainnet versus a named L2, and for audit expectations. Nodework lists EVM next to Solidity because employers split the chips that way. Remote is common. Apply from the listing. The chain in the URL is a hint. The gas model in the description is the job.",
  },
  "front-end": {
    question: "What does a Front End developer do?",
    answer:
      "A front-end developer on Nodework ships the dapp UI that people actually use: screens that talk to wallets, request signatures, and render on-chain state without hiding the risk. Day to day that means React and TypeScript, plus client libraries that read contracts, listen for events, and recover when a wallet rejects a prompt or a user switches networks mid-flow. You own connect buttons, account changes, chain IDs, pending transactions, and the empty states that appear before a wallet has tokens. A marketing landing page is not this job. A design system still matters, but so does making gas, nonce errors, and spend limits obvious before confirm. Teams hire this role when a protocol needs a usable product. Listings name the chain, the wallet set (often injected wallets plus WalletConnect), and whether you also own subgraph or indexing work. Seniority ranges from engineers who have shipped one production dapp to leads who set the front-end architecture. Read each job for the stack. Nodework keeps apply on this site.",
  },
  "full-stack": {
    question: "What does a Full Stack developer do?",
    answer:
      "A full-stack developer on Nodework owns more than one layer of a crypto product: often a React or similar client, an API, and enough contract or indexer literacy to ship a feature without a three-team handoff. You might write the UI that signs, the worker that retries a broadcast, and the tests that prove a deposit is credited once. The job is breadth with a safety constraint. A full-stack title is not permission to skip reviews on anything that moves funds. Listings name TypeScript frequently, then Go, Python, or Solidity as the second language. Read the posting for how much on-chain work is real versus a thin ABI wrapper, and for whether you will be the only engineer. Startups use this tag when they want one person to close a loop. Larger teams use it for product engineers who still touch the chain. Remote and onsite both appear. Nodework will not invent a stack for you. Open the job, check the languages, and apply here if you already work across those layers.",
  },
  gaming: {
    question: "What does a gaming developer do?",
    answer:
      "A gaming developer on Nodework builds games or game platforms that touch crypto rails: on-chain items, wallets in a client, marketplaces, or backends that must not duplicate a mint. Some listings are Unity or Unreal client work. Others are backend, live-ops, or Solidity for item contracts. The interesting problems are economy integrity, latency, and the player experience when a wallet popup interrupts play. You will partner with economy designers and community teams when a season ships. You will also fight bots. A Web3 game job is still a game job: netcode, tools, and content pipelines matter as much as a token. Read the posting for the engine, whether the chain is in the critical path, and whether the studio is shipping a client or only a marketplace. Nodework tags gaming because employers do. It does not host builds. Apply from the listing. Treat \"play to earn\" copy as marketing until the description names the actual systems you will own.",
  },
  ganache: {
    question: "What does a Ganache developer do?",
    answer:
      "Ganache-tagged roles on Nodework are engineering seats that still use or maintain local Ethereum simulation in the older Truffle and Ganache toolchain, or that need someone who can stand up a deterministic chain for tests. In practice you write Solidity, run a personal blockchain for integration tests, and know the quirks of accounts, gas, and forking that those tools expose. Many teams have moved to Hardhat or Foundry. Listings that still name Ganache often mean brownfield test suites, teaching setups, or a product that has not migrated. The job is not to evangelize a brand. It is to keep tests honest and deploys repeatable. You should be able to explain the difference between a local chain and a mainnet fork, and when a test that only passes on Ganache will fail in production. Read the posting for Hardhat, Foundry, or Truffle alongside this tag. Nodework keeps the chip because the import still has it. Apply on this site. Prefer the description's real framework over the URL.",
  },
  golang: {
    question: "What does a Golang developer do?",
    answer:
      "A Golang developer on Nodework writes Go for crypto infrastructure and backends: clients, CLIs, APIs, indexers, and the services that talk to nodes all day. Ethereum's execution and consensus ecosystem made Go a default for a lot of this work, but listings also use it for exchanges, custody, and DevOps-adjacent tooling. You will care about concurrency, context cancellation, and not leaking keys in logs. Production Go in this industry looks like careful gRPC or HTTP services, not a tutorial web app. Listings may say Geth, op-node style software, or internal platforms. Read the job for whether you work on a client, a sidecar, or a product API, and for on-call. Nodework tags Golang so you can filter past Solidity-only feeds. Remote is common. Seniority ranges from people who have shipped one service to engineers who review consensus-adjacent code. Apply from the listing. The language is the filter. The description still has to name the system you will actually change.",
  },
  hardhat: {
    question: "What does a Hardhat developer do?",
    answer:
      "A Hardhat developer on Nodework is a smart contract or tooling engineer who uses Hardhat to compile, test, script, and often fork mainnet. The tag is a workflow, not a personality. You write Solidity, organize tasks, pin compiler versions, and keep deploy scripts from becoming folklore. You should be comfortable with traces, gas reporters, and the moment a test passes locally and fails against a fork because an allowance or a pool changed. Some listings still mention Truffle or Ganache as legacy. Others already mix in Foundry. The job is to make contract changes reviewable. Read the posting for the chain, the audit status, and whether you own DevOps for the pipeline. Nodework keeps Hardhat as a featured chip because employers still print it. Apply on this site. Do not treat the tag as a junior-only filter. Senior protocol engineers use the same tools. The description will tell you if you are writing tests, writing contracts, or maintaining the harness everyone else depends on.",
  },
  intern: {
    question: "What does a Web3 intern do?",
    answer:
      "A Web3 intern on Nodework joins an existing team for a time-boxed period. The listing should name the function, the duration, and whether the internship is paid and remote. Work is scoped on purpose: a research spike, a test suite, a community rotation, or a small implementation with review. You are not the incident owner on day one, and you should not be asked to hold production keys. A good posting says who mentors you and what \"done\" looks like. A weak posting only says Web3. Engineering internships still want a language and a repo you can talk about. Non-tech internships still want writing or operations samples. Nodework collects intern-tagged jobs so they are not buried in the main feed. This landing is not a campus program run by the board. Each employer runs their own process. Read dates, location, and pay on the card, then apply on this site. If you need a longer junior seat, the entry-level landing is the adjacent slice.",
  },
  java: {
    question: "What does a Java developer do?",
    answer:
      "A Java developer on Nodework usually sits in exchange, custody, payments, or enterprise-facing chain integrations rather than in a Solidity-only shop. You might work on matching, settlements, Android-adjacent wallet work, or long-lived backends that talk to nodes through a well-tested client. The language brings the usual strengths: typing, service boundaries, and a culture of tests that financial firms already understand. Crypto adds chain reorgs, decimal precision, and the need to never log a secret. Listings may say Spring, Kotlin alongside Java, or Android. Read the posting for whether you touch keys, whether the role is mobile, and which assets you will support. Nodework tags Java because it still appears in the import next to Go and TypeScript. Remote and onsite both exist, often in regulated shops. Apply from the job page. A Java title in this catalog is not a Web2 leftover by default. It is a stack choice. Confirm the domain in the description before you assume you will write smart contracts. Most of these seats will not.",
  },
  javascript: {
    question: "What does a JavaScript developer do?",
    answer:
      "A JavaScript developer on Nodework builds the programmable layer of a dapp or its tooling: browser clients, Node services, scripts that drive tests, and libraries that wrap RPC. In current listings that often means TypeScript in practice, even when the chip still says JavaScript. You will handle wallet injection, ABI encoding, and the ugly corners of async UI when a transaction sits in a mempool. Some seats are front-end. Some are full-stack. A few are tooling engineers maintaining SDKs. Read the job for React, Node, and whether you will call contracts directly or through a backend. Nodework keeps the JavaScript chip because employers still use it as a filter. It is a language tag, not a seniority. Senior people still write JS when the product lives in a browser. Apply on this site. If the posting also names Solidity, ask how much of the job is on-chain. If it only names JavaScript, expect product engineering with wallet and RPC details, not a protocol research seat.",
  },
  "layer-2": {
    question: "What does a Layer 2 developer do?",
    answer:
      "A Layer 2 developer on Nodework works on rollups, validiums, or the bridges and tooling that connect them to an L1. That can mean sequencer and prover infrastructure, Solidity that is aware of L1/L2 message passing, or product engineering on an L2 where fees and finality differ from mainnet. You need a clear model of what is derived, what is posted, and who can stall a withdrawal. Security reviews of bridges are part of the culture even if your day job is an application. Listings name Optimism-style stacks, zk systems, or internal L2s. Read the posting for whether you write circuits, op-node-class software, or dapps that merely deploy on an L2. Nodework tags Layer-2 so this slice is not lost inside a generic Ethereum feed. Remote is common. Apply from the listing. Treat every bridge UX and every \"instant finality\" claim as something the description must earn. The job is to make the cheaper environment honest, not to hide L1 risk behind a faster block time.",
  },
  marketing: {
    question: "What does a Web3 marketer do?",
    answer:
      "A marketing role on Nodework is non-engineering. You plan and ship the work that gets a crypto product in front of the right people without promising a return you cannot defend. That can be content, lifecycle, partnerships, app-store style listing pages, or launch campaigns around a mint or a protocol upgrade. The constraint is regulatory and reputational: words about yield, tokens, and \"community\" get screenshotted. Good operators work with legal, measure something besides vanity, and know when Discord heat is not demand. Listings name growth, brand, or product marketing. You will partner with design and community, not write Solidity. Nodework lists marketing because the same import that carries engineers also carries these seats. Read the posting for channels, for whether you own paid spend, and for whether the company sells to consumers, developers, or institutions. Apply on this site. Do not treat a marketing landing as a developer feed, and do not treat a token announcement calendar as a substitute for a product.",
  },
  mobile: {
    question: "What does a mobile developer do?",
    answer:
      "A mobile developer on Nodework ships iOS, Android, or cross-platform clients that talk to wallets, dapps, or custody APIs. The hard parts are key handling, deep links, push that does not leak balances, and the UX of a signing prompt on a small screen. Some listings are wallet apps. Others are consumer products with a chain in the background. Stacks include Swift, Kotlin, React Native, and Flutter. You will fight store review, device fragmentation, and the difference between an in-app browser and a real wallet. Security reviews matter because a mobile clipboard and screenshots are attack surfaces. Read the job for whether you own the seed flow, whether you use a third-party wallet kit, and which chains you must support. Nodework tags mobile so these roles are not buried in front-end web. Remote and onsite both appear. Apply from the listing. A mobile title here is engineering. Confirm in the description if you will also write backend or contracts. Many seats will not.",
  },
  moderator: {
    question: "What does a Web3 moderator do?",
    answer:
      "A moderator on Nodework is a trust and safety role, not a developer title. You enforce rules in Discord, Telegram, forums, or in-product chat: spam, impersonation, phishing, and the gray zone where a joke becomes a raid. The job is judgment under speed. You document bans, escalate coordinated attacks, and refuse to become unofficial support for wallet recovery. Some listings mix moderator and community manager. The cleaner postings separate policy from programming. You may work with bots and ticket tools, but writing those bots is usually someone else's job. Coverage hours matter because crypto scams do not wait for a timezone. Read the posting for languages, for whether you have ban power, and for the product you protect. Nodework lists moderator jobs because public channels are part of how these companies run. Apply on this site. Do not treat the tag as an engineering internship, and do not treat it as a growth role. It is closer to operations and safety than to marketing.",
  },
  nft: {
    question: "What does an NFT developer do?",
    answer:
      "An NFT developer on Nodework builds the contracts, metadata pipelines, marketplaces, or clients around non-fungible tokens. That includes mint mechanics, royalty and operator-filter history, reveal flows, and the indexing that makes a gallery page true. You will fight metadata liveness, wash trading pressure, and the UX of approvals that can drain a wallet. Solidity and EVM standards (ERC-721, ERC-1155) are common. Other chains appear too. Some seats are protocol. Others are full-stack around a drop. Design and community partners will care about the moment of mint. Engineering should care about the week after, when listings, burns, and marketplace bugs show up. Read the job for the standard, the chain, and whether you own the metadata server. Nodework tags NFT as a featured chip. Apply from the listing. Treat every setApprovalForAll prompt as part of the product, not a wallet footnote, and confirm whether the role is art-adjacent or purely systems work.",
  },
  node: {
    question: "What does a node developer do?",
    answer:
      "A node developer on Nodework works on the software that participates in a network: full nodes, validators, RPC fleets, or the operators' tooling around them. That is closer to systems and protocol engineering than to a dapp UI. You think about sync, peering, disk, snapshots, and what a stale node does to a product that trusted it. Listings may say Node as in Node.js, or node as in blockchain node. Read the description. The featured chip on this board is used both ways in the wild, so the posting has to disambiguate. Protocol seats name a client and a language (Go, Rust, C++). Application seats name TypeScript services. Operations seats name uptime and alerting. Nodework will not guess. Open the job for on-call, for whether you hold validator keys, and for the network. Apply on this site. If the listing is Node.js product work, expect APIs and workers. If it is validator work, expect runbooks and a much sharper key-handling story.",
  },
  "non-tech": {
    question: "What does a non-tech Web3 role do?",
    answer:
      "Non-tech roles on Nodework are the jobs that ship a crypto product without writing production protocol code: product, design, marketing, sales, community, support, research ops, legal-adjacent coordination, and people programs. The catalog keeps this landing because those seats arrive in the same import as Solidity. Domain fluency still matters. You will hear about wallets, custody, and incidents, and you will be expected not to invent token promises. The work itself is the craft on the posting, not a consolation prize for missing an engineering bar. Read each job for the function, the seniority, and whether travel or night coverage is required. Salary pages for non-tech functions exist elsewhere on the site when bands were published. Nodework does not run a talent marketplace. It lists jobs. Apply from the listing. If you want engineering, use a language or protocol tag instead. If you want this slice, stay here and ignore anyone who treats non-tech as unskilled. These teams fail in public when operations are weak.",
  },
  "open-source": {
    question: "What does an open source Web3 developer do?",
    answer:
      "Open-source tagged roles on Nodework pay people to work in public repositories: clients, SDKs, protocols, and docs that other teams will fork. You write code, review outsiders' PRs, keep a changelog honest, and sometimes administer a grants or contributor bar. The job is engineering plus stewardship. A messy public repo is an incident, not a vibe. Listings name the project, the license expectations, and whether you can work remotely. Some seats are foundation-funded. Others are companies that happen to open-source a stack. You should be comfortable with asynchronous review and with saying no to a feature that would make the protocol unsafe. Read the posting for the language, the on-call, and whether \"open source\" is the product or a side repo. Nodework uses the chip as a filter. Apply on this site. A public GitHub is usually the interview artifact. Do not confuse this tag with unpaid contribution. These are jobs. The description should still include pay, location, and the repository you will actually own.",
  },
  openzeppelin: {
    question: "What does an OpenZeppelin developer do?",
    answer:
      "OpenZeppelin-tagged jobs on Nodework are smart contract engineering seats that expect fluency with OpenZeppelin contracts, upgrades, and the security habits that library exists to encourage. You compose ERC modules, understand Ownable and AccessControl, and know where a custom fork of a library becomes a liability. The work is Solidity, tests, and review. Some listings are at the OpenZeppelin organization. Many more are teams that named the library in a tag. Read the posting to see which. You should be able to explain upgrade patterns, initializer pitfalls, and why copying a contract without its tests is how exploits start. Audits and incident response sit nearby. Nodework keeps the chip because it is a hiring signal in the import. Apply from the listing. Treat the tag as \"contracts with a security bar,\" not as a beginner tutorial. Senior engineers still rely on these libraries. The description will tell you if you are writing product contracts, maintaining a fork, or doing security engineering around them.",
  },
  "pay-in-crypto": {
    question: "What does pay in crypto mean on a Web3 job?",
    answer:
      "Pay in crypto on Nodework is a benefit tag, not a developer title. It means the employer is willing to compensate in digital assets, stablecoins, or a mix, according to the posting. It does not mean the job is protocol engineering. Designers, marketers, and support roles can carry the same chip. You still need to read the listing for the split between cash and tokens, for vesting, and for which asset you would actually receive. Token-only offers have a different risk than a USDC payroll. Legal and tax details are the employer's and yours, not something this board invents. The landing collects jobs that were imported with this benefit so you can browse them together. Remote and onsite both appear. Nodework will show the tag when it is present. It will not convert a salary band into a token price. Open the job, confirm the currency mix, and apply on this site if that mix is acceptable. If you only wanted engineering, pair this benefit with a language filter instead of treating the URL as a stack.",
  },
  "product-manager": {
    question: "What does a Web3 product manager do?",
    answer:
      "A product manager on Nodework is a non-engineering role that still has to be literate in wallets, fees, and irreversible actions. You set scope, sequence launches, and write the specs that keep a mint, a withdraw flow, or an L2 migration from becoming a surprise. The craft is the usual PM work: discovery, tradeoffs, metrics, and saying no. The extra constraint is that a vague requirement next to a spending limit is a safety bug. You will sit with design, engineering, legal, and sometimes community. Listings name consumer, developer platform, or institutional products. Some want ex-finance. Others want ex-gaming. You do not write production contracts unless the posting says player-coach, which is rare. Nodework lists PMs because crypto companies hire them in the same import as Solidity. Read the job for whether you own growth, whether you have a researcher, and how success is measured. Apply on this site. Treat \"Web3 PM\" as a domain, not as a shortcut around product skill.",
  },
  "project-manager": {
    question: "What does a Web3 project manager do?",
    answer:
      "A project manager on Nodework coordinates delivery across engineering, vendors, audits, and launches. It is a non-engineering title. You keep a timeline honest, surface blockers, and make sure an audit window, a mainnet date, and a marketing freeze actually meet. Crypto adds vendors (auditors, market makers, custody) and public incident calendars. Good project managers write status that executives can read and engineers can trust. They do not silently move a freeze. Listings may say delivery manager or technical program manager. Some seats sit inside a DAO's service provider. Others sit inside a studio shipping a game or a wallet. Read the posting for whether you manage people, whether you manage a Gantt, and whether you are expected to understand the stack well enough to smell a fake green status. Nodework keeps the tag distinct from product manager on purpose. Apply from the listing. If you want to set product direction, look at PM roles. If you want to land the plane, this is the slice.",
  },
  react: {
    question: "What does a React developer do?",
    answer:
      "A React developer on Nodework builds component-driven UI for crypto products, almost always in TypeScript in current listings. The work is dapp screens, internal tools, or marketing that still has to embed a live wallet state. You will handle wallet adapters, cache invalidation when a block lands, and accessible forms for scary actions. React is the library. The job is still front-end engineering with chain details. Listings name Next.js or a custom bundler, testing library, and whether you own design-system work. Read the posting for how close you sit to contracts: some React seats only consume a typed API, others call ABIs from the browser. Nodework tags React so it is findable next to the broader front-end chip. Apply on this site. Seniority varies. Staff engineers still write React when the product is a client. Do not treat the tag as junior-only, and do not treat it as a full-stack promise. The description will say if you also own Node services or Solidity. Many will not.",
  },
  refi: {
    question: "What does a ReFi developer do?",
    answer:
      "ReFi-tagged roles on Nodework sit in regenerative finance: products that try to fund climate, public goods, or community treasuries with on-chain rails. The engineering is still engineering. You may write contracts for grants, carbon-adjacent marketplaces, or identity that is less brittle than a viral airdrop. You may also do data, research, or non-tech operations for those teams. The extra product risk is impact claims. A dashboard that overstates tons or beneficiaries is a trust failure. Listings are fewer than DeFi, and they mix mission language with ordinary stack needs (Solidity, TypeScript, research). Read the posting for the mechanism, the chain, and whether measurement is part of the job. Nodework includes the chip because the import does. Apply from the listing. Treat ReFi as a domain filter, not as a guarantee of quality. Confirm the actual systems you will own. If you wanted generic DeFi, the DeFi landing is the larger adjacent slice.",
  },
  research: {
    question: "What does a Web3 researcher do?",
    answer:
      "A researcher on Nodework is usually a non-dev-titled specialist: protocol research, mechanism design, security research, or markets research. Some listings are PhD-shaped. Others want a practitioner who can write a note other engineers will implement. You read papers, run experiments, and kill bad ideas before they become bytecode. Writing is the deliverable as much as math. A research seat is not a community role and it is not an analyst dashboard job, though you will borrow tools from both. Listings name cryptography, MEV, token design, or user research. Read the posting. Nodework uses a single research chip for those clusters, so the description has to disambiguate. Apply on this site. Confirm whether you will publish, whether you will sit with a protocol team, and whether production on-call exists (it should be rare). If the employer wants you to also ship Solidity, that should be explicit. Otherwise treat this as a research craft, not as a junior developer title.",
  },
  ruby: {
    question: "What does a Ruby developer do?",
    answer:
      "A Ruby developer on Nodework typically maintains Rails or Ruby services around a crypto product: admin tools, KYC workflows, CRMs, or the boring reliable APIs that still run a lot of fintech. The chain work often lives next door in another language. Your job is still to ship well-tested web software that does not mis-handle balances when it does touch them. Listings are less common than TypeScript or Go, which is why the chip is useful as a filter. Read the posting for Sidekiq-style jobs, for whether you will call RPC, and for the team's plan (maintain versus migrate). Nodework will not pretend Ruby is the default protocol language. It will show the jobs that named it. Apply from the listing. Senior Rails engineers are in scope. Junior tutorial work is not what most imported posts want. Confirm in the description if you are expected to learn Solidity on the job. Many Ruby seats are product and operations engineering with a ledger as a dependency, not as the daily compiler.",
  },
  rust: {
    question: "What does a Rust developer do?",
    answer:
      "A Rust developer on Nodework writes systems software for chains and crypto infrastructure: clients, runtimes, Solana programs, indexers, and performance-sensitive services. The language is the point. You will think about ownership, unsafe boundaries, and the cost of copies in hot paths. Listings split between Solana application work, Substrate or other runtime work, and general backend that chose Rust for reliability. Read the posting for async runtimes, for no_std constraints, and for whether you own on-chain programs versus off-chain services. Testing and fuzzing culture is part of the pitch at good teams. Nodework tags Rust so it is not mixed into a generic backend feed. Remote is common. Apply on this site. A Rust title is engineering. If the job is Solana, expect accounts and programs. If it is a client, expect networking and sync. The description has to say which. Do not assume every Rust chip is a blockchain node job, and do not assume it is a simple API in a new coat.",
  },
  sales: {
    question: "What does a Web3 sales role do?",
    answer:
      "A sales role on Nodework is non-engineering. You take a crypto product to a buyer: exchanges selling institutional access, infrastructure firms selling RPC or custody, studios selling a platform, or startups selling a B2B API. The craft is pipeline, qualification, and closing without inventing technical claims. You will need enough domain fluency to talk about wallets, SLAs, and compliance, and enough discipline to loop in solutions engineering when a prospect asks about finality. Listings name account executive, business development, or partnerships. Some are commission-heavy. Others are salaried BD in a small team. Read the posting for territory, for whether you sell to crypto-native firms or to traditional finance, and for travel. Nodework lists sales because those jobs arrive with the rest of the catalog. Apply on this site. Do not treat a sales landing as a developer feed. If you wanted to implement the product, open an engineering tag instead. If you wanted to sell it, this is the slice.",
  },
  "smart-contract": {
    question: "What does a smart contract developer do?",
    answer:
      "A smart contract developer on Nodework writes the on-chain programs a product depends on, plus the tests and review habits that keep those programs from becoming an incident. On EVM that is usually Solidity, storage layout, upgrade decisions, and events other systems will index. On other VMs it is the equivalent program model. You will think about admin keys, pause switches, oracle failure, and how a public mempool will reorder your users. Audits are a stage, not a personality: you still write the invariants. Listings name Hardhat, Foundry, or the chain's native toolchain. Read the posting for upgradeability, for whether you own incident response, and for the chain. Nodework keeps smart-contract as a chip beside Solidity because employers split them. Apply from the listing. This is engineering with money in the blast radius. Confirm whether the seat is greenfield protocol, integrations, or maintenance of a live system. The description should not hide which.",
  },
  solana: {
    question: "What does a Solana developer do?",
    answer:
      "A Solana developer on Nodework builds programs, clients, or infrastructure for the Solana runtime. On-chain work is typically Rust: account layouts, instruction handlers, signer checks, and the compute and rent constraints that make naive ports from EVM fail. Off-chain work is RPC, indexers, and TypeScript clients that send transactions with recent blockhashes and retry policy. You have to understand accounts as data, PDAs, and how a program is not a general-purpose contract VM in the Ethereum sense. Listings name Anchor or native program work, plus whether you own a validator-adjacent service. Read the posting for mainnet experience, for audit history, and for whether the job is a consumer app or a core program. Nodework tags Solana so this ecosystem is a first-class landing. Apply on this site. Treat account design as the job, not as a footnote, and confirm the language split. Many product seats mix Rust programs with a TypeScript client. The description should say so.",
  },
  solidity: {
    question: "What does a Solidity developer do?",
    answer:
      "A Solidity developer on Nodework writes Ethereum-family smart contracts: the bytecode that the EVM executes, the tests that try to break it, and the review trail that makes an audit possible. You model storage, function visibility, reentrancy, and upgrade proxies. You read traces when a transaction reverts. You know why a missing access control check is not a style issue. Tooling in listings is usually Foundry or Hardhat, plus a mainnet fork when integrations matter. Some seats are protocol. Others are application contracts for a product team. Audits, bug bounties, and incident runbooks sit next to the compiler. Read the job for the chain (mainnet or an EVM L2), for whether admin keys exist, and for how releases are gated. Nodework treats Solidity as a featured skill landing. Apply from the listing. This is not a tutorial chip. Junior postings should still name tests. Senior postings should still name threat models. The description is the bar, not the URL.",
  },
  truffle: {
    question: "What does a Truffle developer do?",
    answer:
      "Truffle-tagged roles on Nodework are contract and tooling engineers who still work in the Truffle suite: migrations, tests, and the Ganache-era local chain workflow, or who are hired to keep a brownfield pipeline alive. The daily language is still Solidity. The tag tells you the harness. Many teams have moved to Hardhat or Foundry, so a listing that names Truffle is a signal to read carefully: you may be migrating, maintaining, or teaching. You should understand artifact management, how migrations differ from modern deploy scripts, and why a test that only runs in that harness can hide a mainnet bug. Read the posting for the real compiler version and for whether Hardhat is already in the repo. Nodework keeps the chip because the import still uses it. Apply on this site. Do not treat Truffle as a separate career from Solidity. It is a toolchain. The description should say if you will modernize it or live in it.",
  },
  "web3-py": {
    question: "What does a Web3.py developer do?",
    answer:
      "A Web3.py developer on Nodework writes Python that talks to Ethereum-family networks: scripts, indexers, trading or ops bots, research notebooks that became services, and test harnesses. Web3.py is the client library. The job is still production Python: packaging, retries, ABI handling, and not storing keys in a repo. Some listings are data engineering. Others are backend engineers who prefer Python over TypeScript for workers. A few are researchers automating experiments. Read the posting for asyncio versus older patterns, for whether you will also write Solidity, and for the chain. Nodework keeps Web3.py as a featured chip because employers still print it. Apply from the listing. Confirm if Brownie, Ape, or a custom stack sits next to the library. A Web3.py title is engineering. It is not a guarantee of a protocol seat. Many of these jobs are the glue between a node and a product or a desk. The description has the workload.",
  },
  web3js: {
    question: "What does a Web3js developer do?",
    answer:
      "A Web3js developer on Nodework uses the web3.js (or adjacent JavaScript) client to talk to EVM networks from a browser or Node. In practice many teams have also adopted ethers or viem. Listings that still say Web3js mean you will encode calls, subscribe to logs, and handle provider injection. The surrounding job is usually TypeScript front-end or full-stack. You will debug nonce issues, dropped websockets, and the difference between a library default and what a wallet actually signs. Read the posting for React, for whether a backend owns the provider, and for which library is real in the repo versus the tag. Nodework keeps Web3js as a chip because the import still has it. Apply on this site. Treat the tag as an EVM JavaScript client filter, not as a separate language career. If the job also names Solidity, ask how the ABI is generated and who owns it. The description should not leave that fuzzy.",
  },
  "zero-knowledge": {
    question: "What does a zero knowledge developer do?",
    answer:
      "A zero-knowledge developer on Nodework works on proofs: circuits, provers, verifiers, and the product plumbing that makes a proof useful (privacy, scaling, identity, or compression). The job spans research and engineering. You might write a circuit, optimize a prover, or integrate a verifying contract so a dapp can check a proof on-chain. Languages and DSLs vary: Rust, Circom, gnark, Halo2-class stacks, and Solidity for verifiers. You need a threat model for soundness and a practical sense of proving time and memory. Listings name zkEVM, rollups, or application ZK. Read the posting for whether you are research, infra, or application, and for whether trusted setup is in scope. Nodework tags zero-knowledge so this specialty is findable. Apply from the listing. This is not a synonym for cryptography in general, and it is not a front-end job with a buzzword. Confirm the proving stack in the description. If they only want someone to explain ZK on a landing page, that is marketing, not this chip.",
  },

  // Benefit-specific blurbs. Each perk gets its own paragraph instead of the
  // shared benefit fallback, since that fallback was being injected verbatim
  // as both visible copy and FAQPage JSON-LD acceptedAnswer across 20 URLs.
  "4-day-work-week": {
    question: "What does a 4 day work week mean on a Web3 job?",
    answer:
      "A 4 day work week benefit on Nodework means the employer told the import that a shorter week is part of the offer, not that every listing with this chip pays the same for less time. Practically, teams that run this schedule usually mean four full working days rather than a shortened Friday, but the posting is the only place that confirms hours, on-call coverage, and whether the fifth day is genuinely off or reserved for incidents. Crypto products do not pause on a compressed schedule: a validator, a bridge, or an exchange still needs someone reachable when something breaks, so ask how the team staffs weekends and the day off before you assume it is unconditional. Engineering, design, support, and operations roles can all carry this tag. Nodework does not verify the policy or convert it into a shorter list of hours. It shows the jobs that were imported with the chip so you can filter for it, then read the actual offer on the listing before you apply on this site.",
  },
  "401k": {
    question: "What does a 401k benefit mean on a Web3 job?",
    answer:
      "A 401k benefit tag on Nodework means the employer marked a US-style retirement plan as part of the offer in the import. It says nothing on its own about a match percentage, vesting schedule, or which providers the plan uses, and it does not mean every applicant is eligible regardless of country. Web3 companies range from US-incorporated entities running a conventional plan to distributed teams that only offer this to a subset of hires, so treat the chip as a signal to ask, not a guarantee. Some employers pair it with equity or token compensation instead of a larger match, which changes the real value of the package. Engineering and non-engineering roles both carry this benefit when the employer chose to report it. Nodework lists the jobs that came through the import with the tag present. It does not calculate a match, does not give tax advice, and does not confirm eligibility. Read the actual offer letter or the listing for the plan details, then apply from the job page if the rest of the role fits.",
  },
  async: {
    question: "What does async mean on a Web3 job?",
    answer:
      "Async on Nodework describes a working style, not a job function: the team defaults to written updates, recorded demos, and documented decisions instead of requiring everyone online at the same time. That matters more in Web3 than in a single-timezone company because contributors, DAOs, and distributed teams often span a dozen time zones at once. A genuinely async team still has some overlap for incident response, code review, and the rare meeting that needs real-time judgment, so an async chip is not a promise of zero calls. It can appear next to engineering, research, community, or support roles, since all of them can run on written handoffs. The tradeoff is real: async work rewards clear writing and self-direction, and it can slow down decisions that need a fast back-and-forth. Read the listing for actual overlap hours, response-time expectations, and whether any weekly sync is mandatory. Nodework tags the posting when the employer described the team this way. Apply on this site and confirm the working rhythm before you commit to a schedule you have not seen written down.",
  },
  "company-retreats": {
    question: "What are company retreats on a Web3 job?",
    answer:
      "Company retreats on Nodework is a benefit tag for employers that fly a distributed team to one location periodically, usually to work in person for a stretch and then go back to remote. Frequency and length vary widely: some teams do this once a year, others quarterly, and the posting rarely says which without you asking. Crypto and DAO-shaped teams use retreats more than most because so many of them never share an office day to day, so the retreat is often the only in-person contact the team gets. It is not the same as unlimited travel or a relocation package, and it does not imply the company covers a plus-one or extended stay. Engineering, design, community, and operations roles all show up with this chip since the perk is about team structure, not craft. Read the listing or ask directly about who is invited, how travel is booked, and whether attendance is required. Nodework shows the jobs imported with this benefit. It will not invent a schedule or a destination the employer never published. Apply on this site once you have that answer.",
  },
  "coworking-budget": {
    question: "What is a coworking budget on a Web3 job?",
    answer:
      "A coworking budget on Nodework is a stipend some remote-first Web3 employers offer so you can work from a shared office instead of your kitchen table, rather than a requirement to use one. The amount, the approved providers, and whether it renews monthly or annually are set by the employer, not by this tag, and none of that is guaranteed to be generous just because the chip is present. This benefit tends to travel with fully distributed teams that have no company office anywhere, since a coworking budget is how they let people choose their own workspace without covering a lease. It shows up across engineering, design, and operations roles equally, since it is about where you sit, not what you build. If quiet, reliable internet, or separation from home life matters to how you work, this is worth confirming on the listing rather than assuming it exists because the employer is remote-first. Nodework lists jobs that carried the tag in the import. It does not track specific dollar amounts. Read the posting, then apply on this site if the rest of the role fits.",
  },
  "dental-insurance": {
    question: "What does dental insurance mean on a Web3 job?",
    answer:
      "Dental insurance on Nodework is a standard benefit tag, and in this catalog it usually means the employer is a conventionally incorporated company offering a plan through a normal insurer rather than something crypto-native. Coverage level, network, and whether dependents are included are decided by the employer's plan, not by this chip, and eligibility can depend on your country of residence or employment classification (employee versus contractor). Many Web3 companies hire globally as contractors specifically because benefits like this are hard to offer everywhere, so a dental tag on one listing does not mean every role at that company carries it. Engineering and non-engineering seats both appear with this benefit since it is unrelated to the craft. If you are outside the country where the plan is based, ask directly whether an equivalent exists rather than assuming the tag applies to you. Nodework shows the jobs that were imported with this benefit marked. It does not compare plans or estimate value. Read the listing for the real eligibility, then apply on this site.",
  },
  "distributed-team": {
    question: "What does distributed team mean on a Web3 job?",
    answer:
      "Distributed team on Nodework describes company structure, not a perk with a dollar value: the employer has no central office and hires people to work from wherever they already are, across countries and time zones, rather than asking everyone to relocate. It is different from a single-office company that merely allows remote work for some roles. Distributed teams tend to lean on async communication and written process more than co-located ones, though that varies by employer, so pair this tag with the async chip when both matter to you. Payroll and legal setup can get complicated across borders, and how an employer handles that (contractor status, an employer-of-record, direct local entities) affects your actual pay and protections more than the tag does. This label applies across every function, from protocol engineering to community management, because it describes the whole company rather than one team. Nodework marks the jobs that were imported this way. It does not verify payroll structure or legal status. Read the listing for how they actually handle distributed hiring, then apply on this site.",
  },
  "equity-compensation": {
    question: "What is equity compensation on a Web3 job?",
    answer:
      "Equity compensation on Nodework means the employer offers ownership, usually stock options or, less often, a token allocation, as part of total pay, according to the import. It does not tell you the percentage, the strike price, the vesting schedule, or whether the equity is in a company, a token, or both, and those details change the real value enormously. Early-stage Web3 startups often lean on equity to offset a lower cash salary, which can be a reasonable trade or a bad one depending on the company's actual traction, so treat this tag as a prompt to ask for a cap table conversation, not as a number you can bank on. Token-based equity carries extra questions: lockups, unlock schedules, and whether the token has any liquid market yet. This benefit appears across seniority levels and functions, though it is more common in senior and leadership listings. Nodework will not price your options or your tokens. It lists the jobs that carried this tag in the import. Read the offer carefully and get real terms in writing before you apply on this site.",
  },
  "free-gym-membership": {
    question: "What does a free gym membership mean on a Web3 job?",
    answer:
      "A free gym membership on Nodework is a wellness perk, either a stipend toward a gym of your choice or, less often, access to a specific facility if the employer has a physical office. For remote-first Web3 companies this is almost always a reimbursement model rather than a building you can walk into, so do not assume a specific gym or chain is included. The amount and the approval process are set by the employer and are not part of this tag. It sits alongside other wellness-adjacent benefits like a mental wellness budget, and some employers bundle the two while others keep them separate line items, so read the full listing rather than assuming both exist because one does. This perk shows up across engineering and non-engineering roles alike since it has nothing to do with the work itself. Nodework marks the jobs that were imported with this benefit present. It does not track reimbursement caps or eligible vendors. Confirm the real terms on the listing, then apply on this site if the role otherwise fits.",
  },
  fsa: {
    question: "What is an FSA benefit on a Web3 job?",
    answer:
      "An FSA, a flexible spending account, on Nodework is a US-specific tax-advantaged benefit tag: it lets you set aside pre-tax pay for eligible medical or dependent-care costs, and it usually only makes sense paired with a US payroll and a US health plan. If a Web3 employer hires you as a contractor outside the United States, an FSA chip on the listing likely does not apply to your actual offer even if it is present on the posting, because the benefit is tied to how the employer runs payroll where you sit. Contribution limits, the specific eligible expenses, and any employer match are set by IRS rules and the plan administrator, not by this tag, and unused FSA funds can be subject to use-it-or-lose-it rules depending on the plan year. This benefit is more common at later-stage or US-incorporated Web3 companies with formal HR programs than at small distributed teams. Nodework lists jobs that were imported with this tag. It does not give tax advice. Confirm eligibility and plan details directly with the employer before you apply on this site.",
  },
  "home-office-budget": {
    question: "What is a home office budget on a Web3 job?",
    answer:
      "A home office budget on Nodework is a one-time or recurring stipend some remote Web3 employers offer to cover a desk, a chair, a monitor, or other equipment for working from home. It is distinct from a coworking budget, which pays for shared office access instead of gear you keep. The amount, whether it is a single setup payment or an annual refresh, and what counts as an eligible purchase are decided entirely by the employer and are not encoded in this tag. Fully remote and distributed Web3 teams use this benefit more than hybrid ones, since there is no office to equip instead. It applies across functions: an engineer running local test nodes and a community manager on video calls all day have different real needs from the same nominal budget, so ask how the amount was set if ergonomics or hardware matter to your work. Nodework shows the jobs that carried this tag in the import. It does not track specific stipend amounts. Read the listing for the real number, then apply on this site.",
  },
  hsa: {
    question: "What is an HSA benefit on a Web3 job?",
    answer:
      "An HSA, a health savings account, on Nodework is a US-specific benefit tag tied to a high-deductible health plan: it lets you save pre-tax money for medical expenses, and unlike an FSA the balance can roll over and even be invested over time. Like the FSA tag, it generally only applies when the employer runs US payroll and offers a compatible health plan, so a Web3 company hiring you as an international contractor may show this chip on a listing without it applying to your specific offer. Contribution limits and eligibility rules come from the IRS and the plan administrator, not from Nodework, and whether the employer contributes to the account on your behalf varies by company. This tag tends to appear at Web3 companies with a formal US benefits program rather than small crypto-native teams running everything through contractor agreements. It shows up across both engineering and non-engineering roles. Nodework lists the jobs that were imported with this tag. It does not give tax or health-plan advice. Confirm the real eligibility with the employer before you apply on this site.",
  },
  "learning-budget": {
    question: "What is a learning budget on a Web3 job?",
    answer:
      "A learning budget on Nodework is a stipend, usually annual, that an employer sets aside for courses, books, conference tickets, or certifications relevant to your role. In a fast-moving field like Web3, where a new client, a new proving system, or a new L2 can become relevant in a single quarter, this benefit is one of the more directly useful ones for engineers and researchers, though it appears on non-technical listings too. The size of the budget, whether unused funds roll over, and what counts as eligible spend (a security course versus a general management book, for instance) are set entirely by the employer and are not part of this tag. Some companies also count conference travel and audit training against the same pool, which can shrink what is actually available for self-directed learning. Ask directly if you plan to use it for something specific, like a certification with a real cost. Nodework shows the jobs that were imported with this benefit marked. It does not track budget amounts. Read the listing, then apply on this site.",
  },
  "medical-insurance": {
    question: "What does medical insurance mean on a Web3 job?",
    answer:
      "Medical insurance on Nodework is the broadest health benefit tag in the taxonomy, and it means the employer reported some form of health coverage as part of the offer, which can range from a full US group plan to a stipend toward a private policy in another country. Because so many Web3 companies hire across borders as a mix of employees and contractors, this tag hides a lot of variation: two listings at the same company can carry it while meaning very different things depending on where you are hired. Ask specifically whether coverage is through a direct plan, an employer-of-record, or a cash stipend you buy your own policy with, since each has different reliability and cost implications. This benefit appears across every function and seniority level, since it is about employment terms rather than the work itself. Nodework marks the jobs that were imported with medical insurance present in the listing. It does not compare plan quality or network size. Read the actual offer for what is covered, then apply on this site if the role fits.",
  },
  "mental-wellness-budget": {
    question: "What is a mental wellness budget on a Web3 job?",
    answer:
      "A mental wellness budget on Nodework is a stipend some Web3 employers set aside for therapy, counseling, or wellness apps, offered separately from standard medical insurance. It exists because crypto work carries its own stressors, volatile markets, public scrutiny of decisions, and always-on incident risk for infrastructure and security roles, and some employers explicitly fund support for that rather than leaving it inside a general health plan. The amount, approved providers, and whether it is reimbursement-based or a direct subscription are set by the employer, not by this tag, and coverage can be thin even when the benefit is listed. It shows up across engineering, community, and support roles alike, since burnout risk is not unique to one function. If this benefit matters to your decision, ask how it is administered and whether it is available from day one or after a waiting period, since policies differ. Nodework lists the jobs that carried this tag in the import. It does not evaluate the quality or size of the benefit. Read the listing, then apply on this site.",
  },
  "profit-sharing": {
    question: "What is profit sharing on a Web3 job?",
    answer:
      "Profit sharing on Nodework means the employer ties some part of compensation to company or protocol revenue rather than only to a fixed salary or equity grant. It is distinct from equity compensation: profit sharing usually pays out in cash or tokens tied to actual revenue or fee generation, while equity is ownership that may or may not ever convert to cash. For revenue-generating Web3 businesses like exchanges, market makers, or protocols with real fee income, this can be a meaningful part of pay; for early-stage teams with no revenue yet, a profit-sharing clause may be closer to a future promise than current pay. The formula, the frequency of payout, and whether it is discretionary or contractual are entirely up to the employer and are not captured by this tag. This benefit appears more often in trading, business development, and leadership listings than in general engineering roles, though it is not exclusive to them. Nodework shows the jobs that were imported with this tag. It does not model payout scenarios. Read the actual formula in the offer, then apply on this site.",
  },
  pseudonymous: {
    question: "What does pseudonymous mean on a Web3 job?",
    answer:
      "Pseudonymous on Nodework is a workplace-culture tag, not a benefit with a dollar value: it means the employer explicitly allows you to work under a handle instead of your legal name, a norm inherited from crypto-native and DAO communities where core contributors are sometimes known only by an on-chain identity. It does not mean the employer skips identity verification entirely; payroll, tax, and compliance requirements still usually require your real identity behind the scenes even when your public-facing name is a handle. What varies by employer is how much of the team, the community, and the public ever learns who you are, and whether that separation is respected in practice during disputes or incidents. This is more common at protocol-native teams, DAOs, and community-facing roles than at regulated exchanges or custody businesses, which tend to need verified identity throughout. If working under a handle matters to you, ask directly how the employer handles it operationally rather than assuming the tag guarantees full anonymity. Nodework lists the jobs that were imported with this tag. Apply on this site once you understand the real policy.",
  },
  pto: {
    question: "What does PTO mean on a Web3 job?",
    answer:
      "PTO on Nodework means the listing specified a defined, accrued paid-time-off policy, which is a different promise than the unlimited-vacation tag: here the employer sets a specific number of days rather than an open-ended policy. A defined PTO count can be more predictable in practice than an unlimited policy, since research elsewhere has repeatedly shown people often take less time off under unlimited schemes than under a clear allotment, though how any individual employer's culture plays out is not something this tag can tell you. Accrual rules, carryover limits, and whether holidays are counted separately vary by employer and are not part of this tag. Distributed Web3 teams sometimes struggle to enforce consistent PTO policy across contractors in different countries, so ask specifically how the number applies to your employment type. This benefit spans every function and seniority level in the catalog. Nodework marks the jobs that were imported with a PTO policy indicated. It does not track the actual day count per employer. Read the listing for the real number, then apply on this site.",
  },
  "unlimited-vacation": {
    question: "What does unlimited vacation mean on a Web3 job?",
    answer:
      "Unlimited vacation on Nodework means the employer does not cap paid time off with a fixed day count, leaving the amount you actually take to negotiation with your manager and team norms rather than a policy document. This is the inverse of the PTO tag, which signals a defined number of days instead. The honest tradeoff, documented well outside this industry, is that unlimited policies remove an accrued-balance safety net and can result in people taking less time off than they would under a clear allotment, especially at a startup where always-on culture is common. Whether this works well at a given Web3 employer depends heavily on whether leadership visibly takes time off and whether the team is properly staffed for coverage, none of which this tag can tell you. It appears across functions and seniority levels, and is more common at earlier-stage companies than at ones with a formal HR program. Nodework lists the jobs that were imported with this policy marked. It does not track how much time people actually take. Ask about real team norms before you apply on this site.",
  },
  "vision-insurance": {
    question: "What does vision insurance mean on a Web3 job?",
    answer:
      "Vision insurance on Nodework is a standard benefit tag covering eye exams, glasses, or contacts, usually offered alongside medical and dental insurance rather than as a standalone plan. As with the other insurance tags in this taxonomy, it typically depends on the employer running a formal benefits program tied to a specific country, most often the United States, so international contractors at the same Web3 company may not have access to the same plan even when the listing carries this chip. Coverage level, in-network providers, and reimbursement caps are set by the employer's plan and are not encoded in this tag. It is a minor but real benefit relative to medical coverage, and some employers bundle it automatically into a broader health package rather than pricing it separately, which is worth asking about if it factors into your decision. This benefit appears across engineering and non-engineering roles equally, since it is unrelated to the work itself. Nodework shows the jobs that were imported with vision insurance marked. Read the listing for real eligibility, then apply on this site.",
  },
};

const FALLBACK_ENGINEERING: RoleFaq = {
  question: "What does this Web3 engineering role do?",
  answer:
    "Engineering listings on Nodework cover protocol work, application backends, smart contracts, and the tooling that sits around a chain. The tag in the URL is a filter, not a finished job title. Each posting still names languages, seniority, and whether the seat is remote. If you do not recognize the stack, open the description: that is the source of truth. Teams hire across L1 clients, indexers, wallets, and product engineering. Compensation may be a published band or omitted. On-call and key handling show up in infrastructure seats and should be explicit. This fallback exists for tags that do not yet have a hand-written blurb. It does not invent a specialty from the slug. Read the listing for the actual system you would change, then apply on this site. A missing detail is a reason to skip the role, not a reason to assume the stack. Nodework will not fill gaps with a template about shipping product work. The employer has to write the job.",
};

const FALLBACK_NON_TECH: RoleFaq = {
  question: "What does this non-tech Web3 role do?",
  answer:
    "Non-engineering listings on Nodework are product, design, marketing, sales, community, support, research, and operations jobs at crypto companies. The tag is a browse filter. The posting still has to name the function, the hours, and the output. Domain fluency matters: wallets, incidents, and token language will show up even when you never open a compiler. This fallback is for tags without a dedicated paragraph. It does not turn the slug into a fake specialty, and it does not call you a developer. Read the job for travel, coverage, and whether success is a pipeline, a calendar, or a queue. Salary bands appear only when the employer printed both bounds. Apply on this site. If you wanted an engineering landing, use a language or protocol chip instead. If you wanted this work, ignore anyone who treats non-tech as unskilled. These teams fail in public when the operational craft is weak, which is why the catalog keeps the slice.",
};

const FALLBACK_GEO: RoleFaq = {
  question: "What does the Web3 job market look like here?",
  answer:
    "Geo landings on Nodework collect imported Web3 roles tied to a city, country, or region. The mix includes onsite, hybrid, and sometimes remote jobs that named that place. Engineering and non-tech functions both appear. The page is not a government labor report. It is a slice of this catalog. Counts move when the import refreshes. A quiet page is not proof that local teams stopped hiring. Open a job for the real office policy, visa language, and stack. Use the remote control when you want that filter instead of a pin on a map. Related salary pages, when they exist, only use listings that published both a minimum and a maximum. Apply stays on Nodework. This paragraph is the family blurb for places without a dedicated essay. It will mention the place in the question when the landing has a name. It will not invent a ranking of cities or a fake number of openings.",
};

const FALLBACK_BENEFIT: RoleFaq = {
  question: "What does this benefit mean on a Web3 job?",
  answer:
    "Benefit landings on Nodework collect jobs imported with a named perk: pay in crypto, insurance, remote-friendly policies, or the other chips in the taxonomy. The URL is not a job title and it is not an engineering specialty. Designers and protocol engineers can share the same benefit tag. Read each listing for the real offer: who is eligible, whether the perk is global, and how it interacts with pay. This fallback exists when a benefit slug has no dedicated paragraph. It does not invent legal advice, tax advice, or a token price. Counts on the page are whatever the catalog currently holds. Apply on this site. If you came here for a stack, pair the benefit with a skill landing. If you came here for the perk, stay and read the posting rather than assuming every employer means the same thing by the same chip.",
};

const DEFAULT_WEB3: RoleFaq = {
  question: "What does a Web3 developer do?",
  answer:
    "Web3 developers on Nodework build products that use blockchains, cryptography, or crypto-native infrastructure. The work ranges from smart contracts and protocol clients to front-end dapps, backend indexers, and the services that keep wallets and exchanges honest. You will still do ordinary software things (reviews, tests, incidents) with extra failure modes: keys, fees, reorgs, and irreversible state. Roles are not all Solidity. Many listings are TypeScript, Go, or Rust. Seniority and remote policy sit on each card. Read the description for the chain and the blast radius. Nodework is the catalog, not the employer. Apply from the job page. If you are not an engineer, use non-tech, marketing, design, or operations tags instead of this default. This paragraph is the board-wide answer when a landing has no more specific craft. It is not a promise that every title on the home feed writes bytecode.",
};

function articleFor(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word.trim()) ? "an" : "a";
}

function injectStats(item: RoleFaq, stats?: LandingRoleFaqStats): RoleFaq {
  if (!stats) return item;
  const bits: string[] = [];
  if (Number.isFinite(stats.total)) {
    bits.push(
      stats.total === 1
        ? "This landing currently lists 1 role."
        : `This landing currently lists ${stats.total} roles.`,
    );
  }
  if (stats.salaryRange) {
    bits.push(
      `Published salary bands on related pages currently span ${stats.salaryRange}.`,
    );
  }
  if (bits.length === 0) return item;
  return { question: item.question, answer: `${item.answer} ${bits.join(" ")}` };
}

function geoFaq(placeSlug: string): RoleFaq {
  const place = tagLabel(placeSlug);
  return {
    question: `What is the Web3 job market in ${place}?`,
    answer: `Web3 roles listed for ${place} on Nodework include onsite, hybrid, and remote-friendly work that named this place. Engineering seats cover contracts, clients, and product software. Non-tech seats cover community, marketing, design, and operations at the same companies. The page is a catalog slice, not a census. Openings move when the import refreshes, so a busy week is not a permanent rank. Read each job for visa language, office policy, and stack. Salary figures appear only when a posting printed both a minimum and a maximum. Use the remote control if you care more about flexibility than a pin. Related landings exist for internships and entry-level tags. Apply stays on this site. If a listing uses ${place} as a legal entity address and the work is fully remote, believe the description. Nodework will not invent a local ranking or a fake headcount for ${place}. It will show the jobs that survived the import.`,
  };
}

function unknownTagFaq(tag: string): RoleFaq {
  if (isBenefitSlug(tag)) {
    const label = tagLabel(tag);
    return {
      question: `What does ${label} mean on a Web3 job?`,
      answer: FALLBACK_BENEFIT.answer,
    };
  }
  if (isCitySlug(tag) || isCountrySlug(tag) || isRegionSlug(tag)) {
    return geoFaq(tag);
  }
  if (NON_DEV_TAGS.has(tag)) {
    const label = tagLabel(tag);
    return {
      question: `What does ${articleFor(label)} ${label} role do?`,
      answer: FALLBACK_NON_TECH.answer,
    };
  }
  const label = tagLabel(tag);
  return {
    question: `What does ${articleFor(label)} ${label} developer do?`,
    answer: FALLBACK_ENGINEERING.answer,
  };
}

export function roleWhatTheyDo(tag: string): RoleFaq {
  const slug = tag.trim().toLowerCase();
  const written = BLURBS[slug];
  if (written) return { question: written.question, answer: written.answer };
  return unknownTagFaq(slug);
}

export function landingRoleFaq(
  landing?: LandingKind,
  stats?: LandingRoleFaqStats,
): RoleFaq {
  let item: RoleFaq;

  if (!landing) {
    item = DEFAULT_WEB3;
  } else if (landing.kind === "intern") {
    item = roleWhatTheyDo("intern");
  } else if (landing.kind === "entry-level") {
    item = roleWhatTheyDo("entry-level");
  } else if (landing.kind === "tag" || landing.kind === "remote-tag") {
    item = roleWhatTheyDo(landing.tag);
  } else if (
    landing.kind === "city" ||
    landing.kind === "country" ||
    landing.kind === "region"
  ) {
    const place =
      landing.kind === "city"
        ? landing.city
        : landing.kind === "country"
          ? landing.country
          : landing.region;
    item = geoFaq(place);
  } else if (landing.kind === "benefit") {
    item = roleWhatTheyDo(landing.benefit);
  } else if (landing.kind === "remote") {
    item = {
      question: "What does remote Web3 work look like?",
      answer:
        "Remote Web3 work on Nodework is a job tagged remote or hybrid in the import. The craft is whatever the listing says: contracts, front-end, protocol, or non-tech functions. Time zones, overlap hours, and whether any onsite week exists should be in the posting. Remote is not a skill. It is a constraint on how you collaborate and how incidents get covered. Some teams are distributed by default. Others are hiring out of a hub and will say so. Use this landing when location flexibility is the filter you want. Pair it with a skill URL when you also care about Solidity or marketing. Apply stays on this site. Nodework will not invent a salary for remote work. Pay bands appear when employers printed them. Read the description for equipment, legal entity, and whether \"remote\" still means one country.",
    };
  } else {
    item = DEFAULT_WEB3;
  }

  return injectStats(item, stats);
}
