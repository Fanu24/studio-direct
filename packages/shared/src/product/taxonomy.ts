/** Editorial reference vocabulary, not synthetic jobs or candidate activity. */
const SKILL_GROUPS: Record<string, string> = {
  'smart-contracts': 'Solidity|Vyper|Rust|Move|Cairo|FunC|Tact|Clarity|Aiken|Plutus|Yul|Huff|Foundry|Hardhat|Truffle|Brownie|Remix IDE|OpenZeppelin|ERC-20|ERC-721|ERC-1155|ERC-4626|Account abstraction|EIP-712|Smart contract testing|Smart contract upgrades|Gas optimization|Multisig wallets|Token standards|Smart contract deployment',
  'blockchain-infra': 'Ethereum|Solana|Bitcoin|Polygon|Arbitrum|Optimism|Base|Avalanche|Cosmos SDK|Substrate|Polkadot|NEAR|Starknet|zkSync|Sui|Aptos|TON|Cardano|Tezos|Tendermint|CometBFT|Geth|Reth|Erigon|Lighthouse|Prysm|RPC infrastructure|Blockchain indexing|The Graph|Subgraphs|IPFS|Filecoin|Arweave|Chainlink|Oracles|Cross-chain bridges|Inter-blockchain communication|Layer 2 scaling|Optimistic rollups|Zero-knowledge rollups|Data availability|MEV|Sequencers|Validator operations|Consensus protocols|Peer-to-peer networking',
  frontend: 'JavaScript|TypeScript|React|Next.js|Vue.js|Nuxt|Svelte|SvelteKit|Angular|HTML|CSS|Sass|Tailwind CSS|CSS Modules|Web accessibility|Responsive design|Web performance|Progressive web apps|Web Components|Storybook|Redux|Zustand|TanStack Query|Vite|Webpack|Babel|WebAssembly|Three.js|WebGL|D3.js|Ethers.js|Viem|Wagmi|Web3.js|WalletConnect|Solana web3.js|RainbowKit|Web3 wallet integration',
  backend: 'Python|Go|Java|Kotlin|Scala|C|C++|C#|Ruby|PHP|Elixir|Erlang|Haskell|OCaml|Swift|Dart|Node.js|Deno|Bun|Express|Fastify|NestJS|Django|FastAPI|Flask|Spring Boot|ASP.NET Core|Ruby on Rails|Laravel|Phoenix|REST APIs|GraphQL|gRPC|WebSockets|OAuth|OpenID Connect|PostgreSQL|MySQL|SQLite|Redis|MongoDB|DynamoDB|Elasticsearch|OpenSearch|SQL|Database design|Database optimization|Distributed systems|Event-driven architecture|Microservices|Message queues|Apache Kafka|RabbitMQ|Protocol Buffers',
  security: 'Smart contract auditing|Formal verification|Fuzz testing|Symbolic execution|Cryptography|Applied cryptography|Zero-knowledge proofs|Circom|Noir|Halo2|RISC Zero|SP1|zk-SNARKs|zk-STARKs|Security research|Penetration testing|Threat modeling|Incident response|Application security|Cloud security|Infrastructure security|Key management|Multi-party computation|Secure enclaves|Bug bounty research|Slither|Mythril|Echidna|Certora|Access control|Security monitoring|Vulnerability management',
  data: 'Data analysis|Data engineering|Data science|Machine learning|Deep learning|Natural language processing|Large language models|Retrieval augmented generation|MLOps|PyTorch|TensorFlow|scikit-learn|Pandas|NumPy|Apache Spark|Apache Airflow|dbt|DuckDB|ClickHouse|BigQuery|Snowflake|Databricks|Data visualization|Tableau|Power BI|Looker|Metabase|Dune Analytics|Flipside Crypto|On-chain analytics|ETL pipelines|Statistics|Experiment design|A/B testing|Time-series analysis',
  product: 'Product management|Product strategy|Product discovery|Product analytics|Product roadmaps|Technical product management|Product operations|User research|Customer discovery|Requirements analysis|Agile delivery|Scrum|Kanban|Backlog prioritization|Stakeholder management|Go-to-market strategy|Pricing strategy|Growth experiments|Platform strategy|Developer experience|API product management|Marketplace design|Product-led growth|Business analysis',
  design: 'UI design|UX design|Interaction design|Visual design|Design systems|Information architecture|Prototyping|Wireframing|Usability testing|Figma|Sketch|Adobe XD|Adobe Illustrator|Adobe Photoshop|Motion design|After Effects|Blender|3D design|Brand design|Typography|Illustration|Service design|UX writing|Design research|User journey mapping',
  marketing: 'Content marketing|Content strategy|Copywriting|Technical writing|SEO|Technical SEO|Email marketing|Lifecycle marketing|Performance marketing|Paid search|Paid social|Social media marketing|Influencer marketing|Affiliate marketing|Partner marketing|Product marketing|Brand strategy|Public relations|Media relations|Marketing analytics|Attribution modeling|Conversion optimization|Demand generation|Lead generation|Campaign management|Event marketing|Video production|Podcast production|Storytelling',
  community: 'Community management|Community strategy|Discord moderation|Telegram moderation|Reddit moderation|Forum moderation|Community events|Ambassador programs|Developer relations|Developer advocacy|Hackathon organization|Workshop facilitation|Community analytics|Community support|Conflict resolution|Community governance|DAO governance|Proposal writing|Governance research|Ecosystem development',
  'business-development': 'Business development|Partnership development|Enterprise sales|Technical sales|Solution engineering|Account management|Customer success|Sales operations|Sales enablement|Pipeline management|CRM management|Salesforce|HubSpot|Negotiation|Commercial strategy|Market research|Competitive analysis|Ecosystem partnerships|Protocol integrations|Grant management|Venture partnerships|Fundraising|Investor relations',
  operations: 'Business operations|Strategy and operations|Project management|Program management|Operations analytics|Process improvement|Vendor management|Procurement|Customer support|Technical support|Knowledge management|People operations|Recruitment|Technical recruitment|Talent acquisition|Learning and development|Compensation analysis|Workforce planning|Organizational development|Change management|Crisis management|Executive assistance',
  legal: 'Regulatory compliance|Crypto regulation|Financial regulation|Contract drafting|Contract negotiation|Corporate law|Intellectual property|Privacy compliance|GDPR|AML compliance|KYC operations|Sanctions compliance|Compliance monitoring|Regulatory reporting|Policy analysis|Legal operations|Data protection|Consumer protection',
  finance: 'Financial modeling|Financial analysis|Financial planning|Corporate finance|Treasury management|Accounting|Bookkeeping|Financial reporting|Audit|Tax planning|Tokenomics|Token valuation|DeFi research|DeFi lending|Automated market makers|Liquidity management|Quantitative research|Algorithmic trading|Risk management|Portfolio management|Options pricing|Market making|Derivatives|Economic modeling',
  devops: 'Linux|Bash|PowerShell|Docker|Kubernetes|Helm|Terraform|OpenTofu|Ansible|AWS|Google Cloud|Microsoft Azure|Cloudflare Workers|Cloudflare D1|Cloudflare R2|GitHub Actions|GitLab CI|Jenkins|CI/CD|Site reliability engineering|Observability|Prometheus|Grafana|OpenTelemetry|Datadog|Nginx|Caddy|Load balancing|Capacity planning|Disaster recovery|Infrastructure as code|Cost optimization',
  testing: 'Quality assurance|Test automation|Unit testing|Integration testing|End-to-end testing|Playwright|Cypress|Selenium|Vitest|Jest|Mocha|pytest|JUnit|Property-based testing|Load testing|k6|Locust|Postman|API testing|Accessibility testing|Mobile testing|Regression testing|Test strategy|Performance testing',
};

const SKILL_ALIASES: Record<string, string[]> = {
  JavaScript: ['JS', 'ECMAScript'], TypeScript: ['TS'], React: ['React.js', 'ReactJS'],
  'Next.js': ['NextJS', 'Next'], 'Vue.js': ['Vue', 'VueJS'], 'Node.js': ['Node', 'NodeJS'],
  Go: ['Golang'], 'C++': ['CPP'], 'C#': ['CSharp'], PostgreSQL: ['Postgres'],
  'Amazon Web Services': ['AWS'], AWS: ['Amazon Web Services'], 'Google Cloud': ['GCP', 'Google Cloud Platform'],
  'Microsoft Azure': ['Azure'], Kubernetes: ['K8s'], 'CI/CD': ['Continuous integration', 'Continuous delivery'],
  'Zero-knowledge proofs': ['ZK proofs', 'ZKP'], 'Machine learning': ['ML'],
  'Large language models': ['LLMs'], 'Natural language processing': ['NLP'],
  'Developer relations': ['DevRel'], 'Business development': ['BD'],
  'Quality assurance': ['QA'], 'Site reliability engineering': ['SRE'],
  'Web accessibility': ['a11y', 'WCAG'], 'User research': ['UX research'],
};

export function taxonomySlug(name: string): string {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\+/g, ' plus ').replace(/#/g, ' sharp ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export const SKILL_SEEDS = Object.entries(SKILL_GROUPS).flatMap(([category, names]) => names.split('|').map(name => ({
  id: `skill:${taxonomySlug(name)}`, name, slug: taxonomySlug(name), category, aliases: SKILL_ALIASES[name] ?? [],
})));

export const BENEFIT_SEEDS = ('Health insurance|Dental insurance|Vision insurance|Mental health support|Life insurance|Disability insurance|Paid vacation|Paid sick leave|Paid parental leave|Flexible hours|Flexible work location|Home office budget|Coworking allowance|Equipment provided|Learning budget|Conference budget|Certification reimbursement|Retirement contributions|Equity compensation|Token compensation|Performance bonus|Signing bonus|Profit sharing|Visa sponsorship|Relocation assistance|Commuter allowance|Meal allowance|Wellness allowance|Gym membership|Childcare support|Employee assistance program|Paid volunteering|Sabbatical leave|Four-day workweek|Company retreats|Team events|Internet allowance|Phone allowance|Book allowance|Language courses|Mentorship|Career development|Employee referral bonus|Travel insurance|Unlimited paid time off|Fertility support|Annual health checks|Stock purchase plan').split('|').map(name => ({slug: taxonomySlug(name), name, aliases: [] as string[]}));

const ROLE_NAMES = 'Solidity Developer|Smart Contract Engineer|Smart Contract Auditor|Rust Developer|Move Developer|Cairo Developer|Blockchain Engineer|Protocol Engineer|Blockchain Researcher|Consensus Engineer|Cryptography Engineer|Zero-Knowledge Engineer|Security Engineer|Security Researcher|Penetration Tester|Formal Verification Engineer|Validator Engineer|Node Operator|Infrastructure Engineer|DevOps Engineer|Site Reliability Engineer|Cloud Engineer|Backend Engineer|Frontend Engineer|Full Stack Engineer|Mobile Engineer|iOS Engineer|Android Engineer|React Developer|TypeScript Developer|JavaScript Developer|Python Developer|Go Developer|Java Developer|C++ Developer|C# Developer|Data Engineer|Data Scientist|Data Analyst|Machine Learning Engineer|AI Engineer|Quantitative Researcher|Quantitative Developer|Trading Engineer|Token Economist|DeFi Analyst|Investment Analyst|Financial Analyst|Finance Manager|Accountant|Treasury Manager|Risk Manager|Compliance Officer|Legal Counsel|Product Manager|Technical Product Manager|Product Designer|UX Designer|UI Designer|UX Researcher|Graphic Designer|Motion Designer|Developer Advocate|Developer Relations Engineer|Technical Writer|Marketing Manager|Growth Manager|Content Manager|Social Media Manager|Community Manager|Community Moderator|Business Development Manager|Partnerships Manager|Account Executive|Customer Success Manager|Customer Support Specialist|Technical Support Engineer|Operations Manager|Project Manager|Program Manager|Recruiter|People Operations Manager|QA Engineer|Test Automation Engineer|Engineering Manager|Solutions Architect';
const ROLE_ALIASES: Record<string, string[]> = {
  'Smart Contract Engineer': ['Smart Contract Developer'], 'Smart Contract Auditor': ['Solidity Auditor'],
  'Blockchain Engineer': ['Blockchain Developer'], 'Zero-Knowledge Engineer': ['ZK Engineer', 'ZK Developer'],
  'DevOps Engineer': ['DevOps Specialist'], 'Site Reliability Engineer': ['SRE'],
  'Backend Engineer': ['Backend Developer', 'Back End Developer', 'Back End Engineer'],
  'Frontend Engineer': ['Frontend Developer', 'Front End Developer', 'Front End Engineer'],
  'Full Stack Engineer': ['Fullstack Engineer', 'Full Stack Developer', 'Fullstack Developer'],
  'Mobile Engineer': ['Mobile Developer'], 'iOS Engineer': ['iOS Developer'], 'Android Engineer': ['Android Developer'],
  'Go Developer': ['Golang Developer', 'Golang Engineer'], 'Rust Developer': ['Rust Engineer'],
  'Solidity Developer': ['Solidity Engineer'], 'React Developer': ['React Engineer'],
  'Machine Learning Engineer': ['ML Engineer'], 'AI Engineer': ['Artificial Intelligence Engineer'],
  'Quantitative Researcher': ['Quant Researcher'], 'Quantitative Developer': ['Quant Developer'],
  'Token Economist': ['Tokenomics Analyst'], 'Legal Counsel': ['Legal Advisor'],
  'Developer Relations Engineer': ['DevRel Engineer'], 'Developer Advocate': ['DevRel Advocate'],
  'Business Development Manager': ['BD Manager', 'Business Development Lead'],
  'QA Engineer': ['Quality Assurance Engineer'], 'Recruiter': ['Technical Recruiter', 'Talent Acquisition Specialist'],
};
export const JOB_ROLE_SEEDS = ROLE_NAMES.split('|').map(name => ({id: `role:${taxonomySlug(name)}`, name, slug: taxonomySlug(name), aliases: ROLE_ALIASES[name] ?? [], patterns: [name, ...(ROLE_ALIASES[name] ?? [])]}));

const normalizeRole = (value: string) => ` ${value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-_/.,()]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
/** Prefer the most specific phrase. Ambiguous matches remain unmapped for honest salary cohorts. */
export function resolveJobRole(title: string, roles = JOB_ROLE_SEEDS): string | null {
  const value = normalizeRole(title);
  const matches = roles.map(role => ({id: role.id, specificity: Math.max(0, ...role.patterns.filter(pattern => value.includes(normalizeRole(pattern))).map(pattern => normalizeRole(pattern).length))})).filter(match => match.specificity > 0);
  matches.sort((a, b) => b.specificity - a.specificity);
  if (!matches.length || (matches[1] && matches[1].specificity === matches[0].specificity)) return null;
  return matches[0].id;
}

export function validateReferenceTaxonomies() {
  const seen = new Set<string>();
  for (const entry of [...SKILL_SEEDS, ...BENEFIT_SEEDS]) {
    if (seen.has(entry.slug)) throw new Error(`Duplicate or cross-taxonomy slug: ${entry.slug}`);
    seen.add(entry.slug);
  }
  if (SKILL_SEEDS.length < 300 || BENEFIT_SEEDS.length < 40 || JOB_ROLE_SEEDS.length < 60) throw new Error('Reference vocabulary is incomplete.');
  return {skills: SKILL_SEEDS.length, benefits: BENEFIT_SEEDS.length, roles: JOB_ROLE_SEEDS.length};
}
