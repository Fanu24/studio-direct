import {describe, expect, it} from 'vitest';
import {DEFAULT_JOB_ADDONS, parseJobAddons, pricing, quoteJob, type JobQuoteContext} from './pricing';

const free: JobQuoteContext = {plan: null, availableCredits: 0, postsPublishedInPeriod: 0, activePosts: 0, firstPost: true, earlyAccessFreeFirstPost: false};
describe('native job pricing', () => {
  it('includes the company claim without a second charge and makes all addons opt-in', () => {
    const quote = quoteJob(DEFAULT_JOB_ADDONS, free);
    expect(quote.totalCents).toBe(pricing.jobPost.base);
    expect(quote.companyClaimIncluded).toBe(true);
    expect(quote.consumesCredit).toBe(false);
    expect(quote.pinDays).toBe(0);
  });
  it('charges the selected addons and leaves Early Access chargeable for every plan', () => {
    for (const tier of Object.keys(pricing.plans) as Array<keyof typeof pricing.plans>) {
      const result = quoteJob({...DEFAULT_JOB_ADDONS, earlyAccess: true}, {...free, plan: tier, availableCredits: 1});
      expect(result.lines.find(line => line.code === 'early_access')?.amountCents).toBe(pricing.addons.earlyAccess.price);
    }
  });
  it('consumes a plan credit but still charges purchased pins, stacking their duration', () => {
    const quote = quoteJob({...DEFAULT_JOB_ADDONS, hideSalary: true, pinDays: 3}, {...free, plan: 'growth', availableCredits: 1});
    expect(quote.consumesCredit).toBe(true);
    expect(quote.totalCents).toBe(pricing.addons.pin[3]);
    expect(quote.pinDays).toBe(pricing.plans.growth.pinDays + 3);
    expect(quote.durationDays).toBe(pricing.plans.growth.durationDays);
  });
  it('uses plan overage pricing when the last credit has been consumed', () => {
    const quote = quoteJob({...DEFAULT_JOB_ADDONS, hideSalary: true}, {...free, plan: 'starter'});
    expect(quote.totalCents).toBe(pricing.plans.starter.extraPost + pricing.addons.hideSalary);
    expect(quote.consumesCredit).toBe(false);
  });
  it('retains inherited hide-salary and analytics benefits at higher tiers', () => {
    for (const tier of ['growth', 'scale', 'platinum'] as const) {
      expect(pricing.plans[tier].analytics).toBe(true);
      expect(quoteJob({...DEFAULT_JOB_ADDONS, hideSalary: true}, {...free, plan: tier, availableCredits: 1}).lines.find(line => line.code === 'hide_salary')?.amountCents).toBe(0);
    }
  });
  it('switches Platinum to paid overage at the annual boundary independently of the active limit', () => {
    const context = {...free, plan: 'platinum' as const, postsPublishedInPeriod: pricing.platinumFairUse.perYear - 1};
    expect(quoteJob(DEFAULT_JOB_ADDONS, context).totalCents).toBe(0);
    expect(quoteJob(DEFAULT_JOB_ADDONS, {...context, postsPublishedInPeriod: pricing.platinumFairUse.perYear}).totalCents).toBe(pricing.plans.platinum.extraPost);
    expect(() => quoteJob(DEFAULT_JOB_ADDONS, {...context, activePosts: pricing.platinumFairUse.maxActive})).toThrow('Close one');
  });
  it('gives free first-post Early Access only under the explicit promotion flag', () => {
    const addons = {...DEFAULT_JOB_ADDONS, earlyAccess: true};
    expect(quoteJob(addons, {...free, earlyAccessFreeFirstPost: true}).totalCents).toBe(pricing.jobPost.base);
    expect(quoteJob(addons, {...free, firstPost: false, earlyAccessFreeFirstPost: true}).totalCents).toBe(pricing.jobPost.base + pricing.addons.earlyAccess.price);
  });
  it('rejects unknown durations and invalid company allowances', () => {
    for (const pinDays of [-1, 2, '3', null]) expect(() => parseJobAddons({...DEFAULT_JOB_ADDONS, pinDays})).toThrow();
    for (const availableCredits of [-1, 0.5, NaN, Infinity]) expect(() => quoteJob(DEFAULT_JOB_ADDONS, {...free, availableCredits})).toThrow();
  });
  it('restricts confidential purchases to Platinum', () => {
    const addons = {...DEFAULT_JOB_ADDONS, confidential: true};
    expect(() => quoteJob(addons, {...free, plan: 'scale', availableCredits: 1})).toThrow('Platinum');
    expect(quoteJob(addons, {...free, plan: 'platinum'}).totalCents).toBe(pricing.addons.confidential);
  });
});
