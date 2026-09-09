export type NavMenu = {
  href: string;
  label: string;
  links: ReadonlyArray<{ href: string; label: string }>;
};

/**
 * Five navbar dropdowns, mirroring the reference navbar's information architecture:
 * a site menu, Salaries, Internships, Learn Web3 and TOP Web3 Jobs. Their site menu
 * trigger is an unlabelled hamburger; ours keeps a real label and a real href so the
 * trigger is reachable by keyboard and announces itself.
 *
 * Every href here is checked against the dev server; see footer-data.ts for the rule.
 */
export const NAV_MENUS: readonly NavMenu[] = [
  {
    href: "/jobs",
    label: "Jobs",
    links: [
      { href: "/", label: "Home" },
      { href: "/jobs", label: "All Web3 jobs" },
      { href: "/remote-jobs", label: "Remote jobs" },
      { href: "/login", label: "Login" },
      { href: "/login?intent=start", label: "Create a profile" },
      { href: "/hire", label: "Hire" },
      { href: "/web3-jobs-api", label: "Web3 jobs API" },
      { href: "/ads", label: "Advertise" },
      { href: "/pricing", label: "Pricing" },
      { href: "/post-web3-job", label: "Post a job" },
    ],
  },
  {
    href: "/web3-salaries",
    label: "Salaries",
    links: [
      { href: "/web3-salaries", label: "Developer salaries" },
      { href: "/web3-non-tech-salaries", label: "Non-tech salaries" },
      { href: "/highest-paying-web3-jobs", label: "Highest paying Web3 jobs" },
      { href: "/web3-salaries/solana-vs-ethereum", label: "Solana vs Ethereum salary" },
    ],
  },
  {
    href: "/intern-jobs",
    label: "Internships",
    links: [
      { href: "/top-web3-internships", label: "TOP Web3 internships" },
      { href: "/intern-jobs", label: "Web3 internships" },
      { href: "/entry-developer-jobs", label: "Entry developer jobs" },
      { href: "/entry-non-tech-jobs", label: "Entry non-tech jobs" },
      { href: "/entry-designer-jobs", label: "Entry designer jobs" },
    ],
  },
  {
    href: "/learn-web3",
    label: "Learn Web3",
    links: [
      { href: "/learn-web3", label: "Learn Web3" },
      { href: "/learn-web3/all", label: "All" },
      { href: "/learn-web3/article", label: "Articles" },
      { href: "/learn-web3/book", label: "Books" },
      { href: "/learn-web3/bootcamp", label: "Bootcamps" },
      { href: "/learn-web3/challenge", label: "Challenges" },
      { href: "/learn-web3/course", label: "Courses" },
      { href: "/learn-web3/interview", label: "Interviews" },
      { href: "/learn-web3/news", label: "News" },
      { href: "/learn-web3/open-source", label: "Open source" },
      { href: "/learn-web3/tutorial", label: "Tutorials" },
      { href: "/learn-web3/video", label: "Videos" },
      { href: "/learn-web3/whitepaper", label: "Whitepapers" },
      { href: "/learn-web3/beginner", label: "Beginner" },
      { href: "/learn-web3/intermediate", label: "Intermediate" },
      { href: "/learn-web3/advanced", label: "Advanced" },
    ],
  },
  {
    href: "/top-web3-jobs",
    label: "TOP Web3 Jobs",
    links: [
      { href: "/highest-paid-developer-jobs", label: "Highest paid developers jobs" },
      { href: "/highest-paid-non-tech-jobs", label: "Highest paid non-tech jobs" },
      { href: "/highest-paid-designers-jobs", label: "Highest paid designers jobs" },
      { href: "/top-web3-jobs", label: "Top Web3 jobs" },
      { href: "/most-popular-developer-jobs", label: "Most popular developer jobs" },
      { href: "/most-popular-non-tech-jobs", label: "Most popular non-tech jobs" },
      { href: "/most-popular-designers-jobs", label: "Most popular designer jobs" },
      { href: "/web3-companies/top-growing", label: "TOP growing Web3 companies" },
      { href: "/web3-companies", label: "Web3 companies" },
    ],
  },
];

export const NAV_FLAT_LINKS = NAV_MENUS.map((menu) => ({
  href: menu.href,
  label: menu.label,
}));
