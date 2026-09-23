import {describe, expect, it} from 'vitest';
import {effectiveProductFlags} from './flags';

describe('product flags', () => {
  it('keeps the current product until explicitly enabled', () => {
    expect(Object.values(effectiveProductFlags({})).every(enabled => !enabled)).toBe(true);
  });
  it('cannot sell or expose dependent features with missing foundations', () => {
    const flags = effectiveProductFlags({PRODUCT_CANDIDATE_PREMIUM: true, PRODUCT_FEATURED_MEMBERS: true, PRODUCT_REVIEWS: true});
    expect(flags.PRODUCT_CANDIDATE_PREMIUM).toBe(false);
    expect(flags.PRODUCT_FEATURED_MEMBERS).toBe(false);
    expect(flags.PRODUCT_REVIEWS).toBe(false);
  });
  it('enables a complete dependency chain without enabling unrelated features', () => {
    const flags = effectiveProductFlags({PRODUCT_PROFILES_V2: true, PRODUCT_CANDIDATE_PREMIUM: true, PRODUCT_FEATURED_MEMBERS: true});
    expect(flags.PRODUCT_FEATURED_MEMBERS).toBe(true);
    expect(flags.PRODUCT_REVIEWS).toBe(false);
  });
});
