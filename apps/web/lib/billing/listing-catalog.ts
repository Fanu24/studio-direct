import {pricing} from '@gaming/shared';
// Retain historical selections and credits while the new offer is rolled out.
export const BASE_CENTS = pricing.legacy.jobBase;
export const STICKY_CENTS = pricing.legacy.sticky;
export const HIGHLIGHT_CENTS = pricing.legacy.highlight;
export const BUNDLE_LADDER = pricing.legacy.bundles;
export type ListingSelection = {
  stickyDays: keyof typeof STICKY_CENTS;
  highlight: keyof typeof HIGHLIGHT_CENTS;
  color: string;
  logo: boolean;
  support: boolean;
  autoRenew: boolean;
  quantity: number;
};
export const DEFAULT_SELECTION: ListingSelection = {
  stickyDays: 7, highlight: 'standard', color: '#830846', logo: true,
  support: true, autoRenew: true, quantity: 1,
};
export function parseSelection(raw: unknown, kind: 'job' | 'bundle'): ListingSelection {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid options');
  const r = raw as Record<string, unknown>;
  if (typeof r.stickyDays !== 'number' || !Object.hasOwn(STICKY_CENTS,r.stickyDays)
    || typeof r.highlight !== 'string' || !Object.hasOwn(HIGHLIGHT_CENTS,r.highlight)
    || typeof r.logo !== 'boolean' || typeof r.support !== 'boolean' || typeof r.autoRenew !== 'boolean') {
    throw new Error('Choose valid listing options');
  }
  if (typeof r.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(r.color)) throw new Error('Invalid highlight color');
  const quantity = kind === 'job' ? 1 : r.quantity;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 50
    || (kind === 'bundle' && !BUNDLE_LADDER.some(([n])=>n===quantity))) throw new Error('Invalid bundle quantity');
  return {...r, quantity, autoRenew: kind === 'job' && r.autoRenew} as ListingSelection;
}
export function quoteListing(selection: ListingSelection) {
  const unitCents = BASE_CENTS + STICKY_CENTS[selection.stickyDays] + HIGHLIGHT_CENTS[selection.highlight]
    + (selection.logo ? pricing.legacy.logo : 0) + (selection.support ? pricing.legacy.support : 0);
  const percent = selection.quantity > 1 ? BUNDLE_LADDER.find(([n])=>n===selection.quantity)?.[1] ?? 0 : 0;
  const subtotalCents = unitCents * selection.quantity;
  // Reference bundle UI charges whole dollars (24 × $695 × 61% -> $10,175).
  const totalCents = selection.quantity > 1 ? Math.round(subtotalCents * (100-percent) / 10000) * 100 : unitCents;
  return {unitCents, subtotalCents, percent, discountCents:subtotalCents-totalCents,totalCents,currency:'usd' as const};
}
export function formatUsd(cents:number) {return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(cents/100);}
