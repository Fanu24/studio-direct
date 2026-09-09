import {
  LEARN_TOPICS,
  isLearnTopicJobTag,
  learnCategoryLabel,
  type LearnCategory,
  type LearnTopic,
} from "./categories";

export const LEARN_HUB_TITLE = "Learn Web3";
export const LEARN_HUB_DESCRIPTION =
  "Original Nodework notes on how to learn blockchain skills, then browse Solidity, Solana, and intern jobs in the catalog. We do not republish third-party tutorials.";

export const LEARN_HUB_PARAGRAPHS = [
  "Nodework is a hiring catalog first. This Learn hub exists so you can map a skill to listed work without treating the site as a course library. We do not scrape articles, bootcamp syllabi, or video transcripts from other publishers. The pages here are original explainers about how people actually enter Web3 jobs: which tags show up in postings, how internships differ from junior titles, and why a whitepaper is a different kind of homework than a weekend tutorial.",
  "A useful learning path starts with the job, not the curriculum. Open a Solidity, Solana, or intern landing and read five descriptions in a row. You will see the same clusters: smart contracts and audits, protocol clients, wallets and indexers, and the non-tech work that ships those products. That list is a better syllabus than a generic “become a blockchain developer” outline because it is pulled from what employers are trying to hire right now.",
  "Formats still matter. Articles help you name a problem. Books hold a model in your head long enough to use it. Bootcamps compress calendar time. Challenges and open source force you to ship. Courses and videos are fine when you need a guided first pass. Interviews and news keep you honest about what teams ask and what just changed. Whitepapers are the source of truth for a protocol, not a substitute for reading a job. Beginner, intermediate, and advanced pages on this hub talk about those stages without pretending Nodework can grade you.",
  "Use the category links to pick a format, then leave this hub and go into the catalog. Solidity jobs are the Ethereum smart-contract cluster. Solana jobs are Rust plus the Solana runtime. Intern jobs are time-boxed seats, paid or unpaid depending on the listing. Entry-level jobs overlap internships but include junior titles that are not internships. Remote variants exist for most tags. None of those landings are lessons. They are inventories.",
  "If you are hiring, skip this hub and use Hire. Learn is for candidates who need a map. The map is short on purpose. You do not need Nodework to host another Hardhat walkthrough. You need a place that says: this skill shows up in jobs, here is the tag, here is an internship if you are early, and here is how to apply on this site. That is the whole product promise of these pages.",
  "A practical week looks like this. Pick one tag that matches work you can already explain in a sentence. Read the landing, save three roles, and write down the stack each one names. Then pick one learning format from this hub that fills the largest gap. If the gap is “I have never deployed a contract,” a tutorial or challenge beats a news digest. If the gap is “I cannot talk about the protocol,” a whitepaper or book beats another video. Come back to the catalog when you can point at a listing and say what you would do in the first month.",
  "Nodework will not keep a gradebook, a forum, or a certificate. We will keep the catalog current and keep these intros honest about what the listings contain. If a page here ever reads like a copied course, it is a bug. The right next click is always a job tag, an internship, or the FAQ if you need Apply explained. Learning is the work you do elsewhere. This site is where that work is supposed to turn into an application.",
];

/**
 * The "Start your Web3 career" band. The reference Learn IA closes its hub with
 * an audience split (developers, non-tech, designers, everyone, remote) that
 * hands the reader a catalog URL instead of another lesson; we ship the same
 * band pointed at our own landings. Every href here was curl-verified 200
 * against the running catalog - if a landing is renamed, this list has no other
 * guard against drifting into a 404.
 */
export type LearnCareerLane = {
  key: string;
  heading: string;
  blurb: string;
  links: readonly { href: string; label: string }[];
};

export const LEARN_CAREER_LANES: readonly LearnCareerLane[] = [
  {
    key: "developers",
    heading: "For developers",
    blurb:
      "Start where the contracts are. Solidity and Solana are the two largest engineering clusters in the catalog, and entry developer roles are where a first Web3 title usually comes from.",
    links: [
      { href: "/entry-developer-jobs", label: "Entry developer jobs" },
      { href: "/solidity-jobs", label: "Solidity jobs" },
      { href: "/solana-jobs", label: "Solana jobs" },
      { href: "/rust-jobs", label: "Rust jobs" },
    ],
  },
  {
    key: "non-tech",
    heading: "For non-tech",
    blurb:
      "Most Web3 teams hire more non-engineers than engineers once a product ships. Community, marketing, operations and support roles are listed under the same tags the engineering roles are.",
    links: [
      { href: "/entry-non-tech-jobs", label: "Entry non-tech jobs" },
      { href: "/non-tech-jobs", label: "Non-tech jobs" },
      { href: "/community-manager-jobs", label: "Community manager jobs" },
      { href: "/web3-non-tech-salaries", label: "Non-tech salaries" },
    ],
  },
  {
    key: "designers",
    heading: "For designers",
    blurb:
      "Product and brand design in Web3 is mostly ordinary product design against unfamiliar constraints: wallets, signing, irreversible actions. The listings say which of those you would own.",
    links: [
      { href: "/entry-designer-jobs", label: "Entry designer jobs" },
      { href: "/design-jobs", label: "Design jobs" },
      { href: "/highest-paid-designers-jobs", label: "Highest paid designers" },
    ],
  },
  {
    key: "everyone",
    heading: "For everyone",
    blurb:
      "If you are not sure which lane you are in yet, start with the time-boxed roles. Internships and entry-level listings state the duration and the function up front, which makes them easier to read than a senior job description.",
    links: [
      { href: "/top-web3-internships", label: "TOP Web3 internships" },
      { href: "/intern-jobs", label: "Intern jobs" },
      { href: "/entry-level-jobs", label: "Entry level jobs" },
      { href: "/web3-salaries", label: "Web3 salaries" },
    ],
  },
  {
    key: "remote",
    heading: "Web3 remote jobs",
    blurb:
      "A large share of this catalog is remote or hybrid, which is the practical reason people can enter the industry from outside a crypto city. The remote view is a filter over the same listings, not a separate board.",
    links: [
      { href: "/remote-jobs", label: "Remote Web3 jobs" },
      { href: "/remote-solidity-jobs", label: "Remote Solidity jobs" },
      { href: "/web3-cities", label: "Top Web3 cities" },
    ],
  },
];

/**
 * Learn-hub FAQ. The reference hub answers reader questions inline at the
 * bottom of the page; these are our own questions and our own answers, sized
 * to the same slot. They are also the FAQPage JSON-LD source for /learn-web3.
 */
export const LEARN_HUB_FAQ: readonly { question: string; answer: string }[] = [
  {
    question: "Does Nodework host the courses?",
    answer:
      "No. We do not host, mirror or resell lessons, and we do not republish other publishers' tutorials. The Learn hub is original writing about how a skill maps onto listed work, plus links into the catalog. Where you actually study is your choice.",
  },
  {
    question: "Should I learn JavaScript before Solidity?",
    answer:
      "Usually yes, because most Solidity roles in this catalog also ask for a front end or a service around the contract. Read five Solidity listings and count how many mention TypeScript, a wallet library or an indexer. That count is a better answer than any general rule we could give you.",
  },
  {
    question: "How long does it take to get a first Web3 job?",
    answer:
      "We cannot honestly put a number on it, and any board that does is guessing. What we can say from the listings is that time-boxed roles (internships and entry-level titles) turn over faster than senior ones, and that a candidate who can talk about a specific listing does better than one who can talk about a curriculum.",
  },
  {
    question: "Do I need to own crypto to work in Web3?",
    answer:
      "No. Plenty of listings here are ordinary product, infrastructure and go-to-market work at companies that happen to settle on a public ledger. Read the description for whether you will touch keys, custody or contracts. If it does not say, it probably does not.",
  },
  {
    question: "Is a bootcamp worth it?",
    answer:
      "A bootcamp buys calendar time and structure, not a job. Nodework does not run one, does not take referral fees for one and does not rank them. If you are considering one, price it against the seniority of the roles you can already apply to on this site.",
  },
  {
    question: "Where do I apply once I am ready?",
    answer:
      "On the job page. Applications for listings on Nodework are submitted here rather than bounced through a redirect chain, and the FAQ explains what happens after you send one.",
  },
];

type LearnCopyEntry = { title: string; description: string; paragraphs: string[] };

const LEARN_FORMAT_LEVEL_COPY: Record<string, LearnCopyEntry> = {
  all: {
    title: "Learn Web3 in every format",
    description:
      "How articles, books, bootcamps, courses, and practice map onto Nodework job tags. Original notes, not scraped lessons.",
    paragraphs: [
      "This page is the all-formats view of learning Web3 as it relates to Nodework. It is not a feed of every article on the internet, and it is not a search engine for courses. It is a single place to decide which kind of study matches the jobs you can already see on this site. Solidity, Solana, intern, and entry-level landings sit one click away because those tags are how the catalog is actually sliced.",
      "People stall when they collect formats without a job in mind. They bookmark ten tutorials, buy a book they never finish, and then open a board and feel unqualified for every title. The fix is to reverse the order. Start with a listing that names a stack you recognize. Write down the verbs: implement, review, operate, support, research. Then pick one format from this hub that trains those verbs. An article is enough if you only needed a definition. A challenge is better if the listing wants shipped code. A whitepaper is better if the listing is protocol-native.",
      "All formats together also means knowing what not to do. Do not treat news as a course. Do not treat a bootcamp as a guarantee. Do not treat an internship page as a classroom. Intern jobs on Nodework are seats with dates, location, and (when the employer published it) pay. They are not “learn to code” programs run by this site. If you need a classroom, go find one. Then come back and apply.",
      "The catalog will keep changing under you. That is the point of using a live board as the syllabus. A Solidity role this month might ask for Foundry. A Solana role might name Anchor. An intern role might be community rather than engineering. Reading across tags teaches the market faster than a static outline. It also keeps you from over-fitting to one influencer’s stack.",
      "Use this all view when you are not sure which format you need. Scan the category list, pick the one that matches your gap, and leave. If you already know you want interview practice, open that category. If you are early, start with beginner and intern jobs together. If you are returning to the market after shipping elsewhere, skip beginner and read advanced plus the highest-signal tags: Solidity, Rust, Solana, smart contract.",
      "Nodework’s job is still hiring inventory. Learn pages exist so we can talk about skill-building without copying someone else’s lesson. Every paragraph here should send you toward a listing or a tag. If you finish this page and only feel informed, you used it wrong. Open Solidity jobs, Solana jobs, or intern jobs and start reading descriptions until the work is concrete.",
      "A last pass: keep a short written log. Date, tag, listing title, one skill gap, one format you will use this week. That log is more useful than a certificate this site will never issue. When you apply on Nodework, you should be able to point at work you did, not at pages you read here. The Apply form stays on this site. The learning stays yours. Use the category links when you need a narrower format.",
    ],
  },
  article: {
    title: "Learn Web3 from articles",
    description:
      "How long-form writing helps you name Web3 skills before you browse Solidity, Solana, and intern jobs on Nodework.",
    paragraphs: [
      "Articles are how most people first hear a Web3 term used in a hiring sentence. A good article names a problem, shows a tradeoff, and stops before it pretends to be a full education. On Nodework, that is the only job we want articles to do. We do not republish other sites’ posts. This page is about how to use writing you already trust, then convert that vocabulary into a search on this catalog.",
      "Read articles with a tag list open. If the piece is about Ethereum contract storage, the matching inventory is Solidity jobs and smart contract jobs. If it is about parallel runtimes and account models, look at Solana jobs. If it is a career narrative about a first crypto role, intern jobs and entry-level jobs are the honest next click. The article did its work when you can say which landing you will open.",
      "Articles fail when they become a substitute for looking at listings. A polished explainer can make you feel fluent in a protocol you have never operated. The correction is mechanical: after one article, open three live jobs and highlight every noun you cannot defend. Those nouns become the next article, or they become a tutorial or a challenge if reading is no longer the bottleneck.",
      "Hiring managers on this board are not grading your reading list. They are trying to fill a seat. Use articles to reduce vocabulary panic, not to delay applying. If a listing asks for production experience, an article will not create it. If a listing asks that you “understand rollups,” a careful piece plus the job description is often enough to decide whether you should apply or keep studying.",
      "Interns in particular over-index on articles because they are free and infinite. Cap them. Two pieces a week, then catalog time. Intern jobs on Nodework state duration and function. Community internships will not be unlocked by an EVM deep dive. Engineering internships will not be unlocked by a markets op-ed. Match the article to the function in the listing.",
      "When you write, even privately, you finish the article loop. Summarize the piece in the language of a job post: stack, constraints, what you would build in month one. That summary is closer to an application than highlighting is. Nodework’s Apply flow is on-site. Bring that summary with you as the story of how you think, not as a claim that you finished a curriculum we do not host.",
      "Skip listicles that rank “top resources” without tying them to work. This hub is the opposite of that. We point at Solidity, Solana, and intern landings because those are real slices of the catalog. If an article cannot survive contact with those pages, it was entertainment. Keep it if you like. Do not confuse it with preparation. When you are done reading, open a tag and apply if the listing is close.",
    ],
  },
  book: {
    title: "Learn Web3 from books",
    description:
      "When a book is the right depth for Web3 work, and how to connect that reading to Solidity, Solana, and intern jobs on Nodework.",
    paragraphs: [
      "A book is slower than the market and that is why it still helps. Job tags on Nodework move with imports. A book holds a model: how accounts work, how a virtual machine thinks about gas, how a distributed system fails. You do not need Nodework to sell you a bibliography. You need a rule for when a book is the right tool versus when you should be reading listings.",
      "Choose a book when a job description assumes a background you cannot fake in a weekend. Protocol roles, cryptography-adjacent work, and systems jobs often assume you can sit with a long argument. Solidity application jobs may not. Solana jobs that want runtime internals might. Intern jobs almost never require a finished monograph. If you are applying to internships, a book is optional depth, not a gate.",
      "Read with the catalog as a highlighter. When a chapter names an abstraction that shows up in Solidity jobs, note the tag. When it names a runtime detail that shows up in Solana jobs, note that instead. If a chapter never collides with any listing you can find, you may be reading history or trivia. That can still be worth it. It is not the shortest path to Apply.",
      "Do not copy study plans from other sites into this one. We will not host chapter notes from popular titles. If you keep a notebook, keep it yours. The Nodework-shaped output of a book is a shorter list of tags you are willing to be examined on, plus intern or junior landings if you still need a first seat.",
      "Books also correct the news cycle. Crypto headlines compress. Listings lag and then bunch. A book about consensus or client architecture will still be useful when a given token narrative is gone. Pair that stability with the live board so you do not study yourself out of the market. Recheck Solidity, Solana, and intern pages monthly while you read.",
      "If you are hiring, you already know books are a weak filter. Plenty of strong engineers skip them. Plenty of weak applicants brandish them. This page is for candidates. Finish enough of a book to explain a system, then go prove it against a listing. Nodework will not certify the reading.",
      "A practical split: one technical book in progress, one catalog tag in focus, one application in motion. When those three stay in the same domain, the book stops being a stalling tactic. When they drift, you are collecting identity, not skill. Close the book and open intern jobs if you still need a first environment, or Solidity and Solana if you are ready to be specific. Keep the reading tied to a listing you would accept. That pairing is the whole method.",
    ],
  },
  bootcamp: {
    title: "Web3 bootcamps and listed jobs",
    description:
      "How to treat a bootcamp as calendar compression, then use Nodework intern, Solidity, and Solana landings as the real market check.",
    paragraphs: [
      "A bootcamp buys time structure. It does not buy a job, and Nodework does not run one. This page exists so you can place a paid or free cohort next to the actual catalog instead of treating a cohort brand as a hiring channel. If a program promises placement, that promise is theirs. Our inventory is imported listings with tags, locations, and Apply on this site.",
      "Use a bootcamp when you need deadlines more than you need another article. The useful ones force deploys, reviews, and a public artifact. The less useful ones replay slide decks you could have read. Measure a program by whether you can point at work that would survive contact with a Solidity or Solana job description. If you cannot, the cohort was a calendar, not training.",
      "Internships and bootcamps get confused because both are time-boxed. They are not the same. Intern jobs on Nodework are employer seats. A bootcamp is a classroom you pay (or apply) to join. Some internships will take a bootcamp graduate. Some will ignore it. Read the intern landing for function and duration. Do not expect this site to convert a certificate into a listing.",
      "Map cohort modules onto tags as you go. Smart contract weeks belong with Solidity jobs and smart contract jobs. Rust and runtime weeks belong with Solana jobs and Rust jobs. If the program is generalist, your job is to pick one tag and go deep enough to apply. Generalist graduates who stay generalist compete with every other generalist. The catalog is specific. Match it.",
      "Hiring teams on this board will look at what you shipped. They will not scrape our Learn pages to see that you thought about bootcamps. Finish the cohort artifact, put it where a reviewer can see it, then apply through Nodework. If you are early, intern and entry-level landings are the honest slice. If you already shipped, skip intern copy and go to the skill tag.",
      "Be suspicious of any path that tells you to avoid looking at live jobs until graduation. The market will not freeze. Spend one hour a week on this catalog even while the cohort is loud. That hour prevents a nasty surprise in week twelve when the titles you trained for are not the titles in inventory.",
      "Nodework’s stance is simple. We will not list, rank, or republish bootcamp curricula. We will keep intern, Solidity, and Solana landings current so you can sanity-check any program against demand. If a bootcamp cannot survive that check, pick a different format from this hub: a challenge, open source, or a targeted tutorial, then apply anyway if a listing fits. The catalog is the exam the cohort cannot write.",
    ],
  },
  challenge: {
    title: "Web3 challenges and practice",
    description:
      "Use challenges and time-boxed practice to prove skill, then match that work to Solidity, Solana, and intern jobs on Nodework.",
    paragraphs: [
      "A challenge is practice with a finish line: a capture-the-flag, a hackathon track, a weekend deploy, a public puzzle. Nodework does not host those events. We host the jobs that become easier to apply to after you have finished something uncomfortable. This page is about using that discomfort on purpose, then pointing it at a tag.",
      "Pick challenges that collide with listings. If Solidity jobs keep asking for tests and Foundry, a contract-golf puzzle that never tests itself is weaker than a boring suite you wrote. If Solana jobs name Anchor and programs, a challenge in that stack beats another EVM toy. Intern jobs may care more that you finished with other people than that you picked the trendiest repo.",
      "Challenges also teach pace. Listings imply a first-month shape of work. A 48-hour hackathon is not that shape, but it does prove you can scope, cut, and ship. Write a short postmortem for yourself: what you would do differently on a real team. That writeup is closer to an interview than a trophy graphic.",
      "Do not confuse leaderboard rank with hireability. Some excellent engineers skip contests. Some high-rank contest people struggle in product teams. Use the catalog as the second scoreboard. Can you read a Solidity or Solana description and see the overlap with what you just built? If yes, apply. If no, pick a different challenge, not a different identity.",
      "Interns should treat challenges as a way to get a URL. Hiring managers for intern jobs on Nodework still need to see something. A tiny deployed artifact plus a clear README is enough for many intern seats. Do not wait for a perfect portfolio site. The intern landing will tell you whether the seat is engineering, design, or community. Match the challenge to that function.",
      "Open source and challenges overlap. A challenge you abandon is a sketch. A challenge you upstream or maintain becomes open source. If you like the work, follow it onto the open-source category and then onto listings that mention contribution. Nodework will not scrape GitHub for you. You still apply on this site.",
      "Keep the loop tight: one challenge, one tag, one application. Solidity, Solana, intern. Repeat. This hub will not give you problem sets. It will keep reminding you that practice without a listing is a hobby, which is fine, and that Nodework is for the moment you want the hobby to meet a payroll. Finish the artifact, then open the matching tag. Keep that loop until a listing is close enough to apply.",
    ],
  },
  course: {
    title: "Web3 courses and job tags",
    description:
      "Treat courses as guided first passes, then verify the skill against Solidity, Solana, and intern jobs on Nodework.",
    paragraphs: [
      "A course is a guided path with modules and, often, a certificate at the end. Nodework does not sell courses and does not mirror them. This page is about using a course as a first pass through a stack, then abandoning the course the moment the catalog is more specific than the syllabus.",
      "Start a course when you cannot yet read a job description without a glossary. Stop the course when the glossary is no longer the problem. The remainder of most curricula is project theater that lags live listings. Solidity jobs will name tools the course has not reached. Solana jobs will name crate versions the recording does not have. That lag is normal. It is also why the catalog has to win.",
      "Certificates from courses are weak signals on this board. A listing that wants production contracts wants production contracts. A listing that wants an intern wants availability, curiosity, and a small artifact. If a course helped you produce the artifact, it did its job. If it only produced a PDF, it did not.",
      "Map modules to tags as if you were building a custom syllabus. EVM and Solidity modules belong with Solidity jobs. Rust and Sealevel modules belong with Solana jobs. Soft-skill or “Web3 careers” modules belong with intern and entry-level landings, not with protocol tags. When a module does not map, skip it.",
      "Watch for courses that try to keep you inside their campus forever. Our Learn pages are the opposite design: short original copy, then links into inventory. You should feel slightly under-taught and slightly over-exposed to real titles. That tension is useful. It is how you find out whether you are applying this month or still filling a gap.",
      "If you learn better with a cohort, combine this category with bootcamp. If you learn better by shipping, jump to challenge or tutorial. The course is not morally superior. It is one pacing tool. Nodework’s pacing tool is the job board. Use both, then Apply on this site when a listing is close enough.",
      "A weekly habit: one course module, three job descriptions in the matching tag, one sentence about the gap. That sentence is your next module filter. When the gap stays the same for three weeks, the course is not working. Switch format. Solidity, Solana, and intern pages will still be here, updated by imports, not by our opinions about education. Come back to the catalog after every module so the syllabus cannot drift from listed work.",
    ],
  },
  interview: {
    title: "Web3 interview prep",
    description:
      "How to prepare for Web3 interviews using live Nodework listings, not a scraped question bank.",
    paragraphs: [
      "Interview prep on Nodework starts with the listing in front of you, not a leaked question bank we will never host. We do not scrape “top 50 Solidity interview questions” from other publishers. We tell you to read the job, read two neighboring jobs in the same tag, and practice explaining the work those descriptions already named.",
      "For engineering tags, that usually means walking through a system you built and mapping it to the posting. Solidity jobs care about correctness, tests, and upgrade caution. Solana jobs care about accounts, compute, and Rust judgment. Intern jobs often care whether you can learn in public and take feedback. Prepare those stories. Do not memorize trivia that never appears in the catalog.",
      "Write answers out loud. Interviews are speech plus a screen share, not a blog. Take a Nodework job, hide the company name, and explain the first month as if you already had the seat. Where you stall, that is study. Where you are fluent, stop studying and apply. Endless prep is how people miss intern windows.",
      "Behavioral questions still happen in crypto companies. They will ask how you handle incident stress, ambiguous owners, and public mistakes. You do not need a special Web3 behavioral framework. You need examples. Internships are a way to get those examples if you do not have them yet. The intern landing is part of interview prep for that reason.",
      "Skip paid packs that promise to reverse-engineer unnamed studios. The honest dataset is this catalog. If a company listed a role here, the description is the study guide. If they did not list here, we cannot help you invent their process. We can still help you get fluent in the tag they would likely use.",
      "For take-homes, treat them as a short job. Time-box, write tests if the tag is Solidity or Solana, and say what you would do with another week. Then come back to Nodework and apply to neighboring roles while you wait. One take-home should not freeze your search.",
      "This page will not become a question dump. If you want drills, use challenges. If you want depth, use books or whitepapers. If you want a seat so the next interview is easier, intern jobs are the direct instrument. The Apply form is on Nodework. Prepare against listings, then use it. Come back to Solidity, Solana, and intern landings after each mock so the questions stay tied to live work.",
    ],
  },
  news: {
    title: "Web3 news and the job market",
    description:
      "How to read crypto news without confusing headlines with Nodework job tags, internships, and hiring demand.",
    paragraphs: [
      "News is a poor syllabus and a decent weather report. Nodework does not run a newsroom and does not reprint headlines. This page exists to keep news in its lane: useful for knowing what just broke, dangerous as a career plan. Jobs lag narratives. Internships lag even more. If you only follow news, you will train for last week’s token and miss this month’s listing.",
      "Use news to update a watchlist of protocols and employers, then verify them on the catalog. A chain that is loud in the press may have zero Solidity or Solana jobs here. A quiet infrastructure team may have three. The catalog is the correction. Bookmarks to news sites are optional. Bookmarks to tag landings are the work.",
      "Interns should be extra careful. News rewards strong opinions. Intern jobs reward the ability to do bounded work with a team. You do not need a thesis on the latest controversy to apply. You need to show you can learn the stack in the listing. If news is making you perform certainty, close the tab and open intern jobs.",
      "When a headline names a technology that maps cleanly, use it. A piece about Ethereum upgrade mechanics might send you to Solidity jobs. A piece about a high-throughput runtime might send you to Solana jobs. A piece about a lab’s internship class might send you to intern jobs. If you cannot name the landing, the headline was not career information.",
      "Hiring managers are also reading news, which means they are tired of applicants who only speak in headlines. Bring systems, constraints, and artifacts. Nodework Apply is a form about you and the role, not a comment section. Keep the temperature down.",
      "A practical cap: one news pass in the morning, then catalog time. If you cannot point at a tag after the pass, the pass failed. Solidity, Solana, intern. Those three cover a surprising amount of the market this site actually has. Add Rust, smart contract, and entry-level when you need a finer slice. Then apply on Nodework if a listing matches the work you can already show.",
      "We will not archive stories here. If this page ever grows a feed, that would be a different product. Right now Learn is a set of original notes that push you back into inventory. Treat news as caffeine. Treat listings as food. If a headline cannot send you to Solidity jobs, Solana jobs, or intern jobs, it was not career information. Read the catalog next.",
    ],
  },
  "open-source": {
    title: "Learn Web3 through open source",
    description:
      "How contributing to open source maps onto Nodework tags like Solidity, Solana, and internships, without copied contributor guides.",
    paragraphs: [
      "Open source is still the most honest public proof in this industry. Nodework will not scrape your GitHub, and we will not host someone else’s contributing.md. This page is about using contribution as learning that hiring managers can inspect, then applying through the catalog instead of waiting to be discovered.",
      "Pick projects that match tags you would accept as a job. Solidity jobs pair with contract libraries, protocols, and tooling in that stack. Solana jobs pair with programs, validators, and Rust crates. Intern jobs may accept smaller contributions: docs, tests, triage. A first useful intern artifact is often a failing test you fixed, not a new protocol.",
      "Start smaller than your ego wants. Reproduce an issue, write the test, ask a narrow question. That loop teaches the same muscles as a junior week: read unfamiliar code, change a little, explain it. It is also a better story in an interview than a course certificate. Keep the story tied to a listing you are about to apply to.",
      "Do not confuse stars with employment. Some quiet repos are closer to production than famous tutorials. The catalog tells you what production looks like this month. If a repo never collides with Solidity, Solana, or intern descriptions, it may still be a good craft project. It is a weaker bridge into this board.",
      "Maintainers do not owe you a career. They owe the project. Behave like a colleague. That behavior is part of what intern and junior hiring is screening for. Nodework can only show you the seat. The manners you practice in a pull request show up later in the job.",
      "When you apply, link the work, not a manifesto about open source. The Apply form stays on this site. Use it while a contribution is in flight. Waiting for a merge to feel “real” is how people miss intern cycles. A public branch and a clear writeup are already evidence.",
      "If you need a more guided on-ramp, use tutorial or beginner pages, then come back. If you already contribute, skip those and go to the skill tag. This hub’s job is to keep formats from becoming identities. Open source is a method. Solidity, Solana, and intern jobs are the destinations we can actually list. Keep contributing, then apply on Nodework without waiting for a maintainer to hire you. Public work plus a live listing is the whole loop. Do that this week. Repeat until a listing fits.",
    ],
  },
  tutorial: {
    title: "Web3 tutorials and the catalog",
    description:
      "Use tutorials as short drills, then confirm the skill on Nodework Solidity, Solana, and intern job landings. No copied walkthroughs.",
    paragraphs: [
      "A tutorial is a short, opinionated path through a tool. It is the right format when you need to touch a stack once with someone else’s training wheels. Nodework will not republish those walkthroughs. We will tell you how not to drown in them, and how to leave them for the catalog.",
      "Do one tutorial all the way through, including the boring setup. Then throw away the happy path and change a requirement. That second hour is the actual learning. It is also what Solidity and Solana listings are hinting at when they say you will own a surface, not a classroom exercise.",
      "Match tutorials to tags with boring precision. Contract deploy and test tutorials belong with Solidity jobs. Anchor and program tutorials belong with Solana jobs. If you are applying to intern jobs in community or operations, an advanced compiler tutorial is the wrong drill. Read the intern listing’s function before you pick the walkthrough.",
      "Tutorials age badly. Copy-paste errors are a rite of passage. They are also a warning: the market has moved. When the tutorial fights the current toolchain, stop protecting the tutorial. Open the tag landing and see what employers name. That list is your next tutorial filter, or a signal to switch to challenges and open source.",
      "Never submit a tutorial repo as if it were your design. Hiring teams have seen it. Fork it, change the problem, write what you learned, and only then put it near an application. Nodework Apply should point at your change, not at a cloned README.",
      "If tutorials are the only format you consume, you will stay beginner longer than you need to. Pair them with intern jobs if you want a team to assign the next drills. Pair them with real tags if you can already finish unguided. This page is a speed bump, not a library.",
      "We will keep this copy original on purpose. There will be no step-by-step Hardhat or Anchor lesson here. Those exist elsewhere and go stale. Nodework’s durable page is the job tag. Use a tutorial, then click Solidity jobs, Solana jobs, or intern jobs and see whether you can read the descriptions without panic. That is the graduation rule. If you still panic, keep practicing on a smaller artifact, then apply when a listing is close. Then open a listing and apply on this site. Keep going until the listing is readable.",
    ],
  },
  video: {
    title: "Learn Web3 with video",
    description:
      "How to use video without stalling, then move into Solidity, Solana, and intern jobs on Nodework.",
    paragraphs: [
      "Video is convenient and easy to confuse with practice. Nodework does not host courses on a player and does not scrape talks. This page is a warning label with a map. Watch when you need a tour of a UI or a talk from someone who operates a system. Stop watching when you could be changing code, writing, or applying.",
      "Set a rule: one video, one artifact. The artifact can be a note that maps the talk to a Nodework tag, a tiny patch, or an application. If you cannot name the tag, the video was entertainment. Solidity, Solana, and intern landings are the three names you should be able to reach for most of the time.",
      "Conference talks are closer to whitepapers than to tutorials. They tell you what a team is proud of. They rarely tell you how to get hired. Use them to build taste, then verify demand on the catalog. A dazzling talk about a research runtime means nothing if this board has no matching jobs you would take.",
      "Interns overuse video because it feels like being in the room. It is not a room. Intern jobs are rooms. If you need social learning, a bootcamp or an internship beats another 40-hour playlist. If you already have a seat, use video as a supplement, not as a second job.",
      "Playback speed is not a skill. Building the thing in the video without looking at the video is. After a Solidity walkthrough, open Solidity jobs and see whether the nouns match. After a Solana stream, open Solana jobs. After a “how I got my first crypto job” vlog, open intern jobs and read actual constraints: dates, pay, location.",
      "Hiring teams will not ask which channel you subscribe to. They will ask what you did. Keep a public or private log of artifacts, not of hours watched. Then use Nodework Apply while the knowledge is fresh. Waiting until you finish a playlist is a stall that looks like discipline.",
      "This hub will stay text. That is intentional. If you want video, you already know where to find it. Come back here to remember that the product is the catalog. Tags, internships, Apply. Everything else is optional media. Watch less than you apply, and apply on this site. After each video, open Solidity jobs, Solana jobs, or intern jobs and read a live listing. Do that before you queue another talk.",
      "If the listing nouns still look foreign, switch format. A tutorial or challenge beats another hour of playback. Nodework is the catalog check, not the player.",
    ],
  },
  whitepaper: {
    title: "Whitepapers and protocol jobs",
    description:
      "How to read protocol whitepapers as job prep for Nodework protocol, Solidity, and Solana roles, without republished PDFs.",
    paragraphs: [
      "A whitepaper is a protocol’s argument for itself. It is not a tutorial and not a hiring spec. Nodework will not host other people’s papers. This page is about when reading one is the right kind of hard work, and when it is procrastination dressed as seriousness.",
      "Read a whitepaper when the jobs you want assume you can talk about the system’s constraints: consensus, fees, execution, light clients, availability. Many Solidity application jobs will not need that. Some protocol and research jobs will. Solana jobs that live close to the runtime may. Intern jobs usually will not, unless the intern seat is research.",
      "Take notes in the language of work. What fails if an assumption is wrong? What would you measure in production? Those notes transfer into interviews better than quoting section numbers. They also tell you whether you should be on a Solidity landing (application contracts) or a more protocol-shaped tag.",
      "Do not collect papers like trophies. One paper read well beats five skimmed. After each paper, open the catalog and search for the nouns. If nothing in inventory matches, you either found a research niche this board does not cover, or you are studying away from the market we actually have. Both answers are useful. Only one leads to Apply here.",
      "Pair papers with intern or junior seats if you need a team to ground you. Reading without a team can turn into aesthetic opinions. A listing will force tradeoffs: shipping, support, paging. That is the adult form of the paper.",
      "If a paper is too hard, that is data. Drop to beginner or tutorial, then come back. Pretending you understood a proof you could not reconstruct will hurt you in an interview. Honesty plus a smaller artifact is a better Nodework application than fake fluency.",
      "We will not summarize famous papers here. Summaries go stale and they drift into copying. Your notes should be yours. Our links stay on Solidity jobs, Solana jobs, intern jobs, and the other tags that show what employers want this month. Read the paper. Then read the board. Then apply on this site. That sequence is the whole method. Keep it in that order. If a listing still feels opaque after the paper, the job may be application engineering rather than protocol work. Open the skill tag and decide. Nodework will not grade the reading. It will show the seats.",
      "A paper without a listing is still education. A listing without the paper can still be a job. Nodework only hosts the second. Use Solidity jobs and Solana jobs to test whether the paper mapped onto demand this month.",
    ],
  },
  beginner: {
    title: "Beginner Web3 learning",
    description:
      "A beginner map into Web3 work on Nodework: intern jobs, entry-level jobs, and first skill tags without copied 101 lessons.",
    paragraphs: [
      "Beginner on this hub does not mean we will teach you what a blockchain is from zero. The what-is-Web3 page already covers how Nodework uses the word. This page is about first jobs and first tags. If you cannot yet read a listing, start with intern jobs and entry-level jobs. Those landings are honest about time-boxed and junior work. They are also where many people should apply before they call themselves engineers.",
      "Pick one skill tag only after you know the function. Engineering beginners often want Solidity too early. That is fine if you enjoy it, but intern jobs include community, operations, design, and research. Read five intern descriptions before you buy a stack. Then, if the function is engineering, Solidity jobs and Solana jobs become the syllabus.",
      "Your first artifacts should be small and finished. A tiny contract with tests, a tiny program, a research note, a community report. Unfinished mega-projects are a beginner trap. Listings for intern and entry-level seats are written for people who can complete a bounded task. Practice that.",
      "Ignore anyone who says you must know every tag on the chips row. You need one story. Nodework’s catalog is wide because imports are wide. Your application should be narrow. Beginner plus intern is a valid path. Beginner plus Solidity is a valid path. Beginner plus every tutorial on earth is how people stall.",
      "Do not wait to feel ready. Intern windows close. Read the intern landing weekly. If a seat matches, apply on this site even if you are still in a tutorial. The listing will tell you duration and whether it is remote. That information is more important than another week of identity building.",
      "Use other Learn categories as supporting tools, not as a queue you must finish. Articles for vocabulary. Tutorials for a first deploy. Challenges for a URL. Interviews when you have a screen-share booked. News almost never. Whitepapers later. The beginner rule is finish small things and look at intern jobs.",
      "Nodework will not grade you as a beginner. We will keep these notes original and keep the landings current. When you can explain one listing in your own words, you are done with this page. Open intern jobs, entry-level jobs, or a first skill tag, and use Apply. Learning continues after the offer, which is the point of a first seat. That is enough of a plan. Then apply.",
      "If you need a narrower format after this, use tutorial, challenge, or intern copy. Do not collect every category before you file an application on this site.",
    ],
  },
  intermediate: {
    title: "Intermediate Web3 skills",
    description:
      "Intermediate Web3 work: leaving tutorials for Nodework Solidity, Solana, and related jobs you can already explain.",
    paragraphs: [
      "Intermediate means you can finish unguided work in one stack and you are now matching that stack to listings. It is not a certificate. It is a feeling you should test against the catalog. Open Solidity jobs or Solana jobs and see whether the descriptions sound like last quarter’s work, not like a foreign language. If they still feel like a foreign language, you are still beginner, and intern jobs may still be the right instrument.",
      "At this stage, tutorials become a tax. Prefer challenges, open source, and reading code from teams you would join. Use articles and videos only to fill named gaps. The Nodework-shaped habit is weekly time on a tag landing plus one application if anything is close. Intermediate people under-apply because they want a perfect match. Perfect matches are rare. Close matches are how you get conversations.",
      "Specialize on purpose. Solidity plus tests plus a production story is a lane. Solana plus Rust plus a program in production is a lane. Mixing five tags because the chips look nice is how you stay intermediate forever. Pick the landing you would accept an offer from, then let the other tags be supporting characters.",
      "Internships are not off limits. Some intern roles are built for career changers with prior software experience. Read the intern landing instead of assuming intern means teenage. If the seat is too early, entry-level and the skill tag are the better fit. The catalog will not be offended if you skip intern copy.",
      "Interview prep becomes worth it here because you have stories. Use the interview category, but still start from a live Nodework job. Explain a system you shipped. Name what you would do in month one of the listing. That is intermediate interview skill. Trivia nights are not.",
      "Compensation curiosity belongs here too. Salary pages on Nodework only include jobs that published a band. Do not let a number from a screenshot set your identity. Use salary pages as context, then return to the tag you can actually do. Highest paid rankings are a different page. This one is about skill fit.",
      "Leave this page when you are applying monthly without a pep talk. Intermediate is a behavior: you treat the catalog as work, not as inspiration. Solidity, Solana, intern if it still fits, and Apply on this site. We will not host the coursework that got you here. We will host the jobs. Keep the loop weekly until a listing converts.",
    ],
  },
  advanced: {
    title: "Advanced Web3 learning",
    description:
      "Advanced protocol, security, and systems work mapped to Nodework listings. Original notes, not republished research papers.",
    paragraphs: [
      "Advanced on Nodework means you are already employable in a lane and you are choosing harder problems: protocol internals, security review, cryptography in production, or systems that fail loudly. This page will not teach those subjects. It will tell you how to keep learning them without drifting away from the jobs this catalog actually has.",
      "Start from listings even when you are senior. Advanced people sometimes only read papers and chats. Then they are surprised by what a Solidity or Solana description emphasizes: delivery, on-call, collaboration with non-research teammates. Read the jobs. They are the constraints. Whitepapers and books are how you stay sharp inside those constraints.",
      "Intern jobs are usually the wrong landing here, except when you are mentoring or hiring interns. Use intern pages if you are building a team. For your own search, stay on the skill tags and on salary pages if you need bands. Advanced learning that ignores hiring inventory turns into a private university.",
      "Open source at this level is less about first contributions and more about review quality and incident writeups. That work is visible. Put it near applications. Nodework Apply still matters. Being known in a chat does not file the form. The form is on this site.",
      "Be careful with news. At the advanced layer, news is often deal flow and drama. It can still move teams in the catalog. Do a fast pass, then return to tags. If a new runtime is real, Solana-shaped or Solidity-shaped jobs will eventually say so. If they never do, you learned something about this board’s coverage.",
      "Teach, but do not copy. If you write, write original notes. This hub’s rule is the same. We will not republish papers or tutorials. If you teach juniors, send them to intern and beginner pages plus the live tags, not to a scraped reading list.",
      "The advanced loop is short: a hard problem you can explain, a live listing that wants that problem, an application. Solidity, Solana, smart contract, cryptography, zero-knowledge, Rust. Use the chips. Use Hire if you are on the other side of the table. Keep Learn as a map, not as a destination. Nodework remains a catalog. Act like it. Apply on this site when the listing matches the problem you already know how to work. That is the job search, not a seminar.",
      "If you are hiring for those seats, leave Learn and use Hire. If you are applying, keep the artifact next to the listing. Solidity jobs, Solana jobs, and the harder tags are the inventory. This page will not get more technical than that on purpose.",
    ],
  },
};

const LEARN_TOPIC_SUMMARIES: Record<LearnTopic, string> = {
  a16z: "a crypto-focused venture firm whose research and job posts help set hiring language across the industry",
  ai: "the branch of software that lets tools write, review, or reason about code and data automatically",
  bitcoin: "the original proof-of-work blockchain and the scripting model its network still runs on",
  blockchain: "the distributed ledger idea that every other topic on this hub builds from",
  "blockchain-engineer": "the engineering role that builds and operates chain infrastructure rather than a single application",
  btc: "the ticker and shorthand people use for Bitcoin in listings and market discussion",
  "career-advice": "the practical guidance job seekers use to navigate resumes, interviews, and offers in this industry",
  clojure: "a Lisp-family language occasionally chosen for chain tooling and functional prototypes",
  "community-manager": "the role that runs a project's Discord, Telegram, and governance communication",
  "computer-science": "the data structures, algorithms, and systems fundamentals that sit underneath blockchain engineering",
  crypto: "the shorthand most people use for cryptocurrency and the wider digital-asset industry",
  cryptography: "the math, hashing, and signature schemes that keep a blockchain secure",
  css: "the styling language used to build the front end of a decentralized application",
  dao: "a decentralized autonomous organization and the governance tooling that runs it",
  dapp: "a decentralized application, meaning a web front end paired with on-chain logic",
  defi: "decentralized finance: lending, exchanges, and yield products built without a central intermediary",
  discord: "the chat platform most Web3 teams and communities actually run their day on",
  eos: "a delegated proof-of-stake blockchain with its own smart-contract runtime",
  erc: "the family of Ethereum Request for Comment standards that define token and contract interfaces",
  "erc-20": "the ERC-20 standard that most fungible tokens on Ethereum still implement",
  ethereum: "the leading smart-contract blockchain and the EVM most tooling on this hub targets",
  finance: "the traditional finance concepts that carry over into tokenomics and DeFi design",
  ganache: "a local Ethereum blockchain developers run to test contracts before a real deploy",
  gpt: "the generative pretrained transformer models behind most coding copilots and chat tooling",
  hardhat: "an Ethereum development environment for compiling, testing, and deploying Solidity contracts",
  hr: "the human resources function inside crypto-native and Web3-adjacent companies",
  "interview-questions": "the technical and behavioral prompts that come up in Web3 hiring loops",
  java: "a JVM language that shows up in some enterprise and exchange-side blockchain tooling",
  javascript: "the language behind most dApp front ends and the Node services that support them",
  "machine-learning": "the statistical modelling techniques teams apply to on-chain data, trading, and fraud detection",
  nextjs: "the React framework most modern Web3 front ends are shipped with",
  nft: "non-fungible tokens and the standards and marketplaces built around them",
  nlp: "natural language processing techniques used in Web3 bots, search, and support tooling",
  node: "the Node.js runtime used to build indexers, bots, and backend services around a chain",
  "non-tech": "the community, operations, marketing, and support work that keeps a Web3 team running",
  openzeppelin: "an audited smart-contract library most Solidity teams build their own contracts on top of",
  php: "a server-side language occasionally used for Web3 backend integrations and admin tooling",
  polygon: "an Ethereum-scaling network with its own app and validator ecosystem",
  prompt: "prompt engineering: writing and tuning the instructions that steer an AI tool's output",
  python: "a language used for chain scripting, data analysis, and backend services in Web3 teams",
  react: "the UI library most decentralized application front ends are composed with",
  recruiter: "the role that sources, screens, and closes candidates for Web3 teams",
  remix: "a browser-based IDE for writing, testing, and deploying Solidity contracts",
  ruby: "a language occasionally used for Web3 backend tooling and internal scripts",
  rust: "the systems language behind Solana, Polkadot, and other high-performance chains",
  security: "the discipline of auditing smart contracts and protocols before they hold real value",
  "smart-contract": "self-executing on-chain code and the engineering discipline built around writing it safely",
  solana: "a high-throughput blockchain built around the Rust-based Sealevel runtime",
  solidity: "the primary smart-contract language for Ethereum and other EVM-compatible chains",
  sql: "structured query language, used to query indexed on-chain and backend data",
  tezos: "a self-amending blockchain with on-chain governance built into its protocol",
  truffle: "an Ethereum development framework for compiling, testing, and deploying contracts",
  typescript: "a typed superset of JavaScript used across most modern dApp codebases",
  web3: "the broader push toward decentralized, token-based internet infrastructure that this whole site is about",
  "web3-py": "a Python library for talking to Ethereum nodes and contracts",
  web3js: "a JavaScript library for talking to Ethereum nodes and contracts",
  "zero-knowledge": "proof systems that let one party prove a fact without revealing the underlying data",
  "zk-snark": "a specific succinct zero-knowledge-proof construction used in privacy and scaling protocols",
};

const TOPIC_OPENERS: ((label: string, summary: string) => string)[] = [
  (label, summary) => `${label} shows up in Web3 hiring as ${summary}.`,
  (label, summary) => `On this hub, ${label} usually means ${summary}.`,
  (label, summary) => `${label} earns its own page here because it is ${summary}.`,
  (label, summary) => `When a Nodework listing names ${label}, it is pointing at ${summary}.`,
];

const TOPIC_FOLLOWUPS: readonly string[] = [
  "That is a starting definition, not a syllabus, so use it to decide whether the skill matches work you already do.",
  "Nodework will not turn this into a course. The line above is enough to judge fit before you go read a listing.",
  "Treat that as one entry on a longer skill map rather than a finished credential.",
  "That single sentence is meant to save you a search, not replace one.",
];

const TOPIC_STUDY_LINES: readonly string[] = [
  "Pair it with a format above, a tutorial for a first pass or a whitepaper if the work is protocol-native, then go read real postings.",
  "From here the fastest move is picking one format above, article for vocabulary or challenge for practice, and testing what you learned against a live listing.",
  "The formats and levels above still apply: start with beginner or article if the term is new, and go straight to advanced or interview prep if it is not.",
];

function hashSlug(slug: string): number {
  let total = 0;
  for (let index = 0; index < slug.length; index += 1) {
    total += slug.charCodeAt(index) * (index + 1);
  }
  return total;
}

function topicJobLine(slug: LearnTopic, label: string): string {
  if (isLearnTopicJobTag(slug)) {
    return `Nodework lists ${label} roles directly, so open ${label} jobs or the remote version to see who is hiring for it this month.`;
  }
  return `${label} is not a standalone job tag on Nodework, so use it to sharpen a search inside a broader tag such as Solidity, Solana, or smart contract jobs.`;
}

function buildTopicCopy(slug: LearnTopic): LearnCopyEntry {
  const label = learnCategoryLabel(slug);
  const summary = LEARN_TOPIC_SUMMARIES[slug];
  const hash = hashSlug(slug);
  const opener = TOPIC_OPENERS[hash % TOPIC_OPENERS.length]!(label, summary);
  const followup = TOPIC_FOLLOWUPS[(hash >> 2) % TOPIC_FOLLOWUPS.length]!;
  const jobLine = topicJobLine(slug, label);
  const studyLine = TOPIC_STUDY_LINES[(hash >> 4) % TOPIC_STUDY_LINES.length]!;
  const isTag = isLearnTopicJobTag(slug);

  return {
    title: `Learn ${label} for Web3 Jobs`,
    description: `${label} for Web3 work is ${summary}. ${
      isTag ? `See open ${label} jobs on Nodework.` : `Use it inside a broader Nodework job search.`
    }`,
    paragraphs: [`${opener} ${followup}`, `${jobLine} ${studyLine}`],
  };
}

const LEARN_TOPIC_COPY: Record<LearnTopic, LearnCopyEntry> = Object.fromEntries(
  LEARN_TOPICS.map((slug) => [slug, buildTopicCopy(slug)]),
) as Record<LearnTopic, LearnCopyEntry>;

export const LEARN_COPY: Record<LearnCategory, LearnCopyEntry> = {
  ...LEARN_FORMAT_LEVEL_COPY,
  ...LEARN_TOPIC_COPY,
} as Record<LearnCategory, LearnCopyEntry>;

export function learnCopyText(paragraphs: readonly string[]): string {
  return paragraphs.join(" ");
}

export function learnWordCount(paragraphs: readonly string[]): number {
  return learnCopyText(paragraphs).trim().split(/\s+/).filter(Boolean).length;
}
