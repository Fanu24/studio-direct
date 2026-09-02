import { PLAN_COPY } from "../billing/plans";
import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../copy";

export const LEGAL_ENTITY_PLACEHOLDER =
  "Legal entity name to be confirmed before launch. This site is a pre-launch product and is not yet operated by an incorporated company.";

export const TERMS_COPY = {
  title: "Terms of Service",
  legalEntity: LEGAL_ENTITY_PLACEHOLDER,
  thirdParties:
    "Job listings come from third parties, including studio career pages and other public sources. We republish those listings so you can find them in one place.",
  incomplete:
    "Our inventory may be incomplete. We do not list every gaming role that exists, and a missing listing is not a promise that the role is unavailable.",
  noRealtimeLinkedIn:
    "We do not provide real-time LinkedIn coverage. A missing LinkedIn match reflects our last successful index, not a live check of LinkedIn at the moment you view a job.",
  badgeMeaning: LINKEDIN_EXCLUSIVITY_TOOLTIP,
} as const;

export const PRIVACY_COPY = {
  title: "Privacy Policy",
  legalEntity: LEGAL_ENTITY_PLACEHOLDER,
  jobProductPurpose:
    "Purpose 1 — job-board product: we use your account, profile, unlocks, CV, and billing data to operate Studio Direct as a job board (sign-in, search, apply links, quota, and paid plans).",
  recruiterOptInPurpose:
    "Purpose 2 — recruiter talent pool: sharing your profile with verified studios and recruiters is a separate purpose. It is opt-in and off by default. Applying for a job does not opt you in.",
} as const;

export const PRICING_COPY = {
  title: "Pricing",
  monthly: PLAN_COPY.monthly.label,
  yearly: PLAN_COPY.yearly.label,
  billingNotLive:
    "Paid billing is not live yet. Checkout is not available until we enable it.",
  billingLive: "Choose a plan to continue to checkout.",
} as const;
