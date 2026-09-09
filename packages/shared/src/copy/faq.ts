export type FaqItem = {
  question: string;
  answer: string;
};

/** Optional live counts. Omit fields rather than inventing numbers. */
export type FaqStats = {
  jobCount?: number;
  placeSummary?: string;
  salaryNote?: string;
};

export const CAREER_FAQ_QUESTIONS = [
  "How does Web3 work?",
  "Is a Web3 career legit?",
  "Is it hard to get a Web3 job?",
  "What skills are needed for Web3?",
  "How do I get a job in Web3 development?",
  "Which places hire the most?",
  "Is it hard to learn Web3?",
  "What is Web3 used for?",
  "What are Web3 jobs?",
  "What is Web3 and the metaverse?",
  "Is Web3 a cryptocurrency?",
  "How do I apply on Nodework?",
  "How is salary data calculated?",
  "Are Web3 jobs remote-friendly?",
  "Do Web3 companies pay in crypto or in fiat currency?",
  "How do I know if a Web3 job listing is legitimate?",
  "What is the difference between a Web2 job and a Web3 job?",
  "Do I need blockchain experience to get a Web3 job?",
] as const;

function jobsWording(stats?: FaqStats): string {
  if (typeof stats?.jobCount === "number" && Number.isFinite(stats.jobCount)) {
    const n = Math.max(0, Math.floor(stats.jobCount));
    return n === 1
      ? "Nodework currently lists 1 open role in the catalog."
      : `Nodework currently lists ${n} open roles in the catalog.`;
  }
  return "Nodework lists live Web3, blockchain, and crypto roles as the import refreshes. Counts move, so this page does not freeze a headline number.";
}

function placesWording(stats?: FaqStats): string {
  if (stats?.placeSummary?.trim()) {
    return stats.placeSummary.trim();
  }
  return "On Nodework, hiring clusters in a few familiar hubs and in fully remote teams. United States and European cities show up often, alongside Singapore, London, and other crypto centers. Remote listings are a large share of the board, so a city rank is not the whole market. Open a geo landing or the remote feed when you want a place-specific slice. Inventory is imported, so a quiet city page is not proof that local teams stopped hiring.";
}

function salaryWording(stats?: FaqStats): string {
  if (stats?.salaryNote?.trim()) {
    return stats.salaryNote.trim();
  }
  return "Salary pages on Nodework only fold in jobs that published both a minimum and a maximum. Listings without a band still appear in the catalog and are skipped in the rollup. That keeps averages honest when many postings omit pay.";
}

export function careerFaq(stats?: FaqStats): FaqItem[] {
  return [
    {
      question: "How does Web3 work?",
      answer:
        "Web3 products keep some of their state on a public ledger that many independent nodes replay. A user holds keys in a wallet, signs a transaction, and broadcasts it to that network. Validators or miners include it in a block. Smart contracts are the programs those nodes agree to run. That is the mechanical loop. Around it sit ordinary software problems: a front-end that talks to a wallet, an indexer that turns logs into queries, an API that a mobile app can call, and operations that keep RPC endpoints alive. Nodework is not a protocol. It is a job catalog for teams that ship that stack. When a posting says Web3, read the description for the chain, the custody model, and whether you will touch contracts or only the product around them. The ledger is infrastructure. The work is still shipping software people can finish.",
    },
    {
      question: "Is a Web3 career legit?",
      answer:
        "Yes, as a career path it is real payroll, real companies, and real delivery risk. Teams pay engineers, product people, legal, and support to keep wallets, exchanges, and on-chain products running. The field is volatile: token prices move, headcount follows funding, and some brands disappear. That does not make the work fictional. It makes diligence part of the job search. Look for a named employer, a concrete stack, and a hiring process you can complete. Nodework lists those roles as they are imported. A listing is not an endorsement of a token. Treat each company like any other startup: read the product, check whether users already exist, and decide if the compensation (cash, tokens, or both) matches the risk. Legitimacy is about the employer and the work, not about a slogan on the landing page.",
    },
    {
      question: "Is it hard to get a Web3 job?",
      answer:
        "It can be competitive, especially for protocol and smart contract seats that ask for shipped work. Difficulty tracks what you can show, not whether you used the word Web3 on a resume. People who have a public repo, a mainnet contribution, or a clear product story in an adjacent stack tend to move faster than people who only completed a tutorial. Non-tech roles still need domain fluency: support has to explain seed phrases, marketing has to avoid promising yield you cannot defend. Intern and entry-level landings exist on Nodework because some teams hire for those tags. A quiet week on the board is not a closed industry. Apply to roles whose description you can actually do, keep a short portfolio, and use internships or open-source when you need a first artifact. The catalog will not rank your odds. It will show what teams are willing to post.",
    },
    {
      question: "What skills are needed for Web3?",
      answer:
        "The useful skills depend on the seat. Contract engineers need Solidity or another on-chain language, testing, and enough EVM or SVM mental models to reason about gas, accounts, and failure. Application engineers need TypeScript or another product language, wallet flows, and the patience to handle chain reorgs and rejected signatures. Protocol work leans on systems languages, networking, and cryptography. Analysts need SQL or Python and a way to read on-chain data without trusting a single dashboard. Non-tech roles need the vocabulary of custody, compliance, and community without pretending to write bytecode. Across all of them: written communication, the ability to read a spec, and skepticism toward unaudited money flows. Nodework tags (Solidity, Solana, marketing, and the rest) are filters for those clusters. The job text still names the real bar. Learn the skill the listing asks for, then the chain it sits on.",
    },
    {
      question: "How do I get a job in Web3 development?",
      answer:
        "Start with a stack you can defend in an interview, then add the chain-specific layer. Most application roles still want JavaScript or TypeScript, tests, and a product you have shipped. Contract roles want a language such as Solidity or Rust, a testing story, and evidence you understand upgrades, oracles, and admin keys. Build one small public artifact: a dapp with a wallet connect, a program on a test network, or a meaningful open-source patch. Read listings on Nodework for the languages teams actually name instead of collecting certificates. Network in public channels if that helps you, but a clear GitHub history beats a cold pitch. Intern and entry-level pages are the right slice when you need a first seat. Apply on the job page. Keep learning after you ship, because clients, fee markets, and audit expectations change. The path is ordinary engineering, with extra operational risk when money is on-chain.",
    },
    {
      question: "Which places hire the most?",
      answer: `${placesWording(stats)} ${jobsWording(stats)} Filter by city, country, region, or remote when you want that geography rather than a global ranking.`,
    },
    {
      question: "Is it hard to learn Web3?",
      answer:
        "It is learnable, and it is uneven. If you already ship web software, the jump is mostly new failure modes: keys, fees, finality, and the fact that a bug can move funds. If you are new to programming, you are learning software and ledgers at once, which takes longer. You do not need every chain. Pick one execution environment (often EVM or Solana), learn how a wallet signs, and write tests before you touch mainnet. Documentation, public testnets, and audited example contracts are enough to start. Courses help some people and stall others. Difficulty drops when you can explain a transaction you constructed, not when you can recite a slogan. Nodework will not teach the stack. It will show which skills employers currently tag. Use internships, documentation, and small repos as practice, then read real job descriptions to see what is missing.",
    },
    {
      question: "What is Web3 used for?",
      answer:
        "Teams use Web3 rails when they want shared state that is not owned by a single application database. That includes transferring value, encoding ownership of a digital item, coordinating a treasury, and settling markets that run while the team is offline. In the job market that shows up as exchanges, wallets, lending and trading protocols, NFT products, games with on-chain items, analytics, and the compliance work around all of it. Plenty of listings also use the word for infrastructure: nodes, indexers, bridges, and developer tooling. Not every product needs a chain. Many that do still have a conventional web app in front. On Nodework, usage is whatever the employer shipped: read the posting for the chain, the asset, and the user. The useful question is not whether Web3 can do a thing. It is whether this team has users, custody, and a reason the ledger is in the critical path.",
    },
    {
      question: "What are Web3 jobs?",
      answer: `Web3 jobs are roles at companies whose products use blockchains, cryptography, digital assets, or the infrastructure those products depend on. Engineering seats cover smart contracts, protocol clients, dapp front-ends, backend indexers, and security. Non-tech seats cover product, design, research, marketing, sales, community, support, and operations. ${jobsWording(stats)} A title that says Web3 is a filter, not a skill. The description still has to name the stack, the seniority, and how you apply. Browse the catalog by tag when you want Solidity or marketing, or open intern and entry-level landings when you want those hiring tags. Remote pages collect roles marked remote or hybrid. Nodework does not run a talent directory. It lists jobs you can open and apply to on this site.`,
    },
    {
      question: "What is Web3 and the metaverse?",
      answer:
        "Web3 is a hiring and product label for software that uses public ledgers, wallets, and tokens. The metaverse is a different claim: a persistent shared space, usually with avatars, worlds, and real-time interaction. Job posts sometimes glue the two together when a game or world wants on-chain items, a token, or a marketplace. They are not synonyms. You can ship a wallet with no world to walk around in. You can ship a virtual space that settles in an ordinary database. On Nodework, treat each word as a clue and then read the description. If the role is rendering, gameplay, or community in a virtual world, that is product and game work. If the role is contracts, indexing, or wallet UX, that is ledger work. Some teams need both. The catalog will not resolve the hype. It will show which employers asked for which skills this week.",
    },
    {
      question: "Is Web3 a cryptocurrency?",
      answer:
        "No. Web3 is not a coin, a ticker, or a single network. Cryptocurrencies are digital assets that use cryptography and, in the usual case, a blockchain to transfer value. Bitcoin and ether are cryptocurrencies. Web3 is the looser name for products, jobs, and infrastructure around those rails: wallets, contracts, exchanges, and the companies that hire for them. A role can be Web3-flavored and never touch a token. A token can exist with almost no product around it. On Nodework the distinction matters because salary pages, tags, and landings mix both. If you want asset-native work, look at crypto, Bitcoin, DeFi, or exchange listings. If you want application engineering, look at the language and product tags. Do not treat a Web3 URL as proof that you will be paid in a token. The posting has to say that.",
    },
    {
      question: "How do I apply on Nodework?",
      answer:
        "Open a job from the catalog or a landing page, then use Apply. The form stays on Nodework. We do not send you to another job board as the public apply action. You do not need an account to browse descriptions or to submit that form. Attach what the listing asks for: a resume, a portfolio, or a short note. After you send it, the employer side of the process is theirs. A missing role is not proof the job closed. Inventory can be incomplete, and imported posts can lag. If you only wanted to read, the job page is enough. If you want a later dashboard or to post a role, that is a separate account flow. Legal wording lives on the terms and privacy pages. The apply path itself is meant to be short: find the listing, read it, apply on this site.",
    },
    {
      question: "How is salary data calculated?",
      answer: `${salaryWording(stats)} Role, country, and region salary pages reuse that rule so a sparse market does not look richer than the postings. When a landing shows a range, it comes from those published bands, not from a guess. Compensation can still include tokens or equity that never enter the rollup. Read the job for the mix. If this page has no live range, it is because too few imported roles included both bounds, not because pay is secret in the industry. Use salary pages as a snapshot of what employers chose to print, then open the listing for the rest.`,
    },
    {
      question: "Are Web3 jobs remote-friendly?",
      answer:
        "Many Web3 teams build for a global, always-on network, so a broad share of the postings on Nodework are explicitly remote or remote-first. That is a structural fact about how the industry hires, not a promise about any single listing. Some jobs on the board are onsite because the employer runs a trading desk, a studio, or a regulated entity that needs people in one place. Others carry no clear remote status because the import could not read one from the source, which is a data gap in that listing, not evidence the role is onsite. Use the remote landing or the remote filter when flexibility is what you actually want, and still read each posting for time zone overlap and whether remote means anywhere or one specific country. Nodework will not guess a policy the listing never stated.",
    },
    {
      question: "Do Web3 companies pay in crypto or in fiat currency?",
      answer:
        "Both, and the mix depends entirely on the employer. Many Web3 companies run ordinary fiat payroll for cash compensation and add equity or a token allocation on top, similar to how a traditional startup uses stock options. Others, especially smaller or crypto-native teams, offer part or all of pay in stablecoins or a project's own token, which carries different tax and volatility exposure than a fiat salary. Nodework tags a pay-in-crypto benefit when a listing named it, and that landing is the closest thing to a filter for this. A missing tag does not mean crypto pay is off the table, since some employers negotiate that privately during an offer. Confirm the actual split between cash, stablecoins, and any token before you accept a role, and treat token-heavy compensation as carrying more risk than a conventional salary.",
    },
    {
      question: "How do I know if a Web3 job listing is legitimate?",
      answer:
        "Read for the same signals that separate any real job from a scam, plus a few specific to this industry. A legitimate listing names a real company, a product you can find independently, and a hiring process that never asks you to pay for training, software, or equipment upfront. Be wary of postings that promise guaranteed token returns, ask for wallet access as part of an interview task, or push you to sign something before a real conversation happens. Crypto recruiting carries more impersonation risk than most fields because company identities and community channels are comparatively easy to fake. Cross-check the employer's own site and socials outside of the job listing itself before you apply. Nodework imports postings from other sources and does not independently vet every employer beyond what the listing states, so treat the catalog as a starting point for your own research, never as a guarantee.",
    },
    {
      question: "What is the difference between a Web2 job and a Web3 job?",
      answer:
        "Most of the day-to-day work is the same: writing code, reviewing pull requests, talking to users, and shipping releases on a schedule. The difference sits in a few specific places. Web3 roles add a ledger as a dependency, so engineers reason about wallets, gas, finality, and the fact that a bug can move real funds instead of only breaking a page. Product and design roles have to make irreversible actions clear instead of relying on an undo button. Support and community roles handle wallet recovery and scam patterns a typical help desk rarely sees. Compensation can include tokens or equity structures a conventional offer letter does not have. None of this changes the underlying craft: a backend engineer moving from a normal API to one backed by a chain is still a backend engineer, with new failure modes layered on top. Read each listing for the real stack.",
    },
    {
      question: "Do I need blockchain experience to get a Web3 job?",
      answer:
        "For contract and protocol-specific seats, usually yes: employers want some evidence you can write and test on-chain code, even if that evidence is a small public repository rather than production history. For most other roles, a strong background in an adjacent field matters more than prior blockchain time. A backend engineer with real production and reliability experience, a designer with a shipped product history, or a support lead who has handled sensitive account issues can often pick up the chain-specific parts on the job. Intern and entry-level landings on Nodework exist because some teams explicitly hire for less experience. Read each listing for what it actually requires instead of assuming the word Web3 raises the bar on everything equally. Having no relevant background in either software or the company's actual domain is a bigger gap than never having touched a blockchain.",
    },
  ];
}
