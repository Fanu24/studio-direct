import { PLAN_COPY } from "../billing/plans";
import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../copy";

export const LEGAL_ENTITY_PLACEHOLDER =
  "Operator identity, business address and contact details must be configured before launch.";

export const TERMS_COPY = {
  title: "Terms of Service",
  legalEntity: LEGAL_ENTITY_PLACEHOLDER,
  thirdParties:
    "Job listings come from third parties, including company career pages and other public sources. We republish those listings so you can find them in one place.",
  incomplete:
    "Our inventory may be incomplete. We do not list every Web3 role that exists, and a missing listing is not a promise that the role is unavailable.",
  noRealtimeLinkedIn:
    "We do not provide real-time LinkedIn coverage. A missing LinkedIn match reflects our last successful index, not a live check of LinkedIn at the moment you view a job.",
  badgeMeaning: LINKEDIN_EXCLUSIVITY_TOOLTIP,
} as const;

export const PRIVACY_COPY = {
  title: "Privacy Policy",
  legalEntity: LEGAL_ENTITY_PLACEHOLDER,
  jobProductPurpose:
    "Purpose 1 — job-board product: we use your account, profile, saved jobs, alerts, CV, applications and billing data to operate Nodework. Job search and applications are free. Employers, advertisers and verified recruiters can purchase services.",
  recruiterOptInPurpose:
    "Purpose 2 — recruiter talent pool: sharing your profile with verified companies and recruiters is a separate purpose. It is opt-in and off by default. Applying for a job does not opt you in. Public profile visibility is a separate choice. Recruiter contact and CV access stops when you revoke talent-pool consent.",
  recruiterExports:
    "Paid recruiter CSV exports require a second, separate permission in Profile visibility, as well as talent-pool consent. Exports include your profile fields and email, not your CV file. We record recruiter access and exports. Revoking either permission excludes you from future exports; it cannot recall files already downloaded by a recruiter.",
  applications:
    "An internal application shares the information you submit and any attached CV with the employer responsible for that job. You can withdraw it from My applications: this removes its CV file and application text and stops employer access. A record of the withdrawal remains in your history. Withdrawal cannot recall a copy an employer previously downloaded. External applications follow the destination employer's process.",
  advertising:
    "Direct sponsorships record ad impressions and clicks. When third-party advertising is enabled, the advertising provider may process device and browser information under the choices collected by its consent platform. Network ads stay disabled until the required consent signals are available. Advertising preferences can be changed through the consent platform when it is configured.",
} as const;

export const PRICING_COPY = {
  title: "Pricing",
  monthly: PLAN_COPY.monthly.label,
  yearly: PLAN_COPY.yearly.label,
  billingNotLive:
    "Paid billing is not live yet. Checkout is not available until we enable it.",
  billingLive: "Choose a plan to continue to checkout.",
} as const;
