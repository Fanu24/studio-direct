export const pricing = {
  currency: 'usd',
  jobPost: {base: 12900, durationDays: 30},
  companyClaim: 15000,
  addons: {
    hideSalary: 2500,
    earlyAccess: {price: 1999, hours: 12},
    pin: {1: 3500, 3: 6500, 7: 12000, 14: 17500, 30: 24500},
    confidential: 4900,
  },
  plans: {
    starter: {price: 36000, posts: 3, extraPost: 12000, durationDays: 45, seats: 2, pinDays: 0, badge: 'bronze', hideSalaryIncluded: false, analytics: false, shortlistInvites: 0, hiringNow: false, newsletter: 'none', talentInvites: 0, confidential: false, atsFeed: false, prioritySupport: false},
    growth: {price: 57500, posts: 5, extraPost: 11500, durationDays: 45, seats: 3, pinDays: 1, badge: 'silver', hideSalaryIncluded: true, analytics: true, shortlistInvites: 0, hiringNow: false, newsletter: 'none', talentInvites: 0, confidential: false, atsFeed: false, prioritySupport: false},
    scale: {price: 88000, posts: 8, extraPost: 11000, durationDays: 60, seats: 5, pinDays: 3, badge: 'gold', hideSalaryIncluded: true, analytics: true, shortlistInvites: 20, hiringNow: true, newsletter: 'monthly', talentInvites: 0, confidential: false, atsFeed: false, prioritySupport: false},
    platinum: {price: 150000, posts: null, extraPost: 5000, durationDays: 60, seats: null, pinDays: 7, badge: 'platinum', hideSalaryIncluded: true, analytics: true, shortlistInvites: 20, hiringNow: true, newsletter: 'every_post', talentInvites: 100, confidential: true, atsFeed: true, prioritySupport: true},
  },
  platinumFairUse: {perYear: 30, maxActive: 5},
  talentExtraPack: {invites: 50, price: 4900},
  candidate: {premiumMonthly: 999, premiumAnnual: 7900, verifiedBadge: 3900},
  flags: {EARLY_ACCESS_FREE_FIRST_POST: false},
  // Historical offers remain decodable; they are not offers for new v2 purchases.
  legacy: {
    jobBase: 29900,
    sticky: {0: 0, 1: 4900, 3: 9900, 7: 14900, 14: 19900, 30: 29900},
    highlight: {none: 0, standard: 9900, custom: 14900},
    logo: 4900, support: 9900,
    candidate: {currency: 'eur', monthly: 900, yearly: 5900},
    sponsors: {1: 499900, 2: 399900, 3: 299900, 4: 199900},
    bundles: [[2,20],[4,29],[6,30],[8,31],[10,32],[12,33],[14,34],[16,35],[18,36],[20,37],[22,38],[24,39],[26,40],[28,41],[30,42],[32,43],[34,44],[36,45],[38,46],[40,47],[42,48],[44,49],[46,50],[48,51],[50,55]],
  },
} as const;

export type CompanyPlanTier = keyof typeof pricing.plans;
export type PinDays = 0 | keyof typeof pricing.addons.pin;
export type JobAddons = {hideSalary: boolean; pinDays: PinDays; earlyAccess: boolean; confidential: boolean};
export const DEFAULT_JOB_ADDONS: JobAddons = {hideSalary: false, pinDays: 0, earlyAccess: false, confidential: false};
export type JobQuoteContext = {
  plan: CompanyPlanTier | null;
  availableCredits: number;
  postsPublishedInPeriod: number;
  activePosts: number;
  firstPost: boolean;
  earlyAccessFreeFirstPost: boolean;
};
export type QuoteLine = {code: 'job' | 'hide_salary' | 'pin' | 'early_access' | 'confidential'; amountCents: number; included: boolean; durationDays?: number};

export function parseJobAddons(raw: unknown): JobAddons {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Choose valid job options.');
  const value = raw as Record<string, unknown>;
  if (['hideSalary', 'earlyAccess', 'confidential'].some(key => typeof value[key] !== 'boolean')
    || typeof value.pinDays !== 'number' || (value.pinDays !== 0 && !Object.hasOwn(pricing.addons.pin, value.pinDays))) {
    throw new Error('Choose valid job options.');
  }
  return {hideSalary: value.hideSalary as boolean, pinDays: value.pinDays as PinDays,
    earlyAccess: value.earlyAccess as boolean, confidential: value.confidential as boolean};
}

/** Context is loaded on the server; never accept credit balances or a tier from checkout input. */
export function quoteJob(addons: JobAddons, context: JobQuoteContext) {
  const selection = parseJobAddons(addons);
  for (const value of [context.availableCredits, context.postsPublishedInPeriod, context.activePosts]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid company allowance.');
  }
  if (context.plan !== null && !Object.hasOwn(pricing.plans, context.plan)) throw new Error('Invalid company plan.');
  const plan = context.plan ? pricing.plans[context.plan] : null;
  const platinum = context.plan === 'platinum';
  if (platinum && context.activePosts >= pricing.platinumFairUse.maxActive) {
    throw new Error(`You have ${pricing.platinumFairUse.maxActive} active posts. Close one to publish a new one.`);
  }
  if (selection.confidential && !plan?.confidential) throw new Error('Confidential posts require Platinum.');
  const consumesCredit = !!plan && !platinum && context.availableCredits > 0;
  const withinFairUse = platinum && context.postsPublishedInPeriod < pricing.platinumFairUse.perYear;
  const base = consumesCredit || withinFairUse ? 0 : plan?.extraPost ?? pricing.jobPost.base;
  const lines: QuoteLine[] = [{code: 'job', amountCents: base, included: base === 0}];
  if (selection.hideSalary) lines.push({code: 'hide_salary', amountCents: plan?.hideSalaryIncluded ? 0 : pricing.addons.hideSalary, included: !!plan?.hideSalaryIncluded});
  if (selection.pinDays) lines.push({code: 'pin', amountCents: pricing.addons.pin[selection.pinDays], included: false, durationDays: selection.pinDays});
  if (selection.earlyAccess) {
    const free = context.firstPost && context.earlyAccessFreeFirstPost;
    lines.push({code: 'early_access', amountCents: free ? 0 : pricing.addons.earlyAccess.price, included: free});
  }
  if (selection.confidential) lines.push({code: 'confidential', amountCents: pricing.addons.confidential, included: false});
  return {lines, totalCents: lines.reduce((sum, line) => sum + line.amountCents, 0), currency: pricing.currency,
    consumesCredit, durationDays: plan?.durationDays ?? pricing.jobPost.durationDays,
    pinDays: (plan?.pinDays ?? 0) + selection.pinDays, companyClaimIncluded: true};
}

export function money(cents: number, currency: string = pricing.currency): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Invalid price.');
  return new Intl.NumberFormat('en-US', {style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2}).format(cents / 100);
}
