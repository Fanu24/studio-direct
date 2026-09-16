// Public configurator observed 2026-09-16: https://web3.career/post-web3-job
export const BASE_CENTS = 29900;
export const STICKY_CENTS = { 0: 0, 1: 4900, 3: 9900, 7: 14900, 14: 19900, 30: 29900 } as const;
export const HIGHLIGHT_CENTS = { none: 0, standard: 9900, custom: 14900 } as const;
// Discrete quantity ladder recorded in the reference audit; never interpolate percentages.
export const BUNDLE_LADDER = [[2,20],[4,29],[6,30],[8,31],[10,32],[12,33],[14,34],[16,35],
  [18,36],[20,37],[22,38],[24,39],[26,40],[28,41],[30,42],[31,43],[32,44],[33,45],
  [34,46],[35,47],[36,48],[37,49],[38,50],[39,51],[40,55]] as const;
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
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 40
    || (kind === 'bundle' && !BUNDLE_LADDER.some(([n])=>n===quantity))) throw new Error('Invalid bundle quantity');
  return {...r, quantity, autoRenew: kind === 'job' && r.autoRenew} as ListingSelection;
}
export function quoteListing(selection: ListingSelection) {
  const unitCents = BASE_CENTS + STICKY_CENTS[selection.stickyDays] + HIGHLIGHT_CENTS[selection.highlight]
    + (selection.logo ? 4900 : 0) + (selection.support ? 9900 : 0);
  const percent = selection.quantity > 1 ? BUNDLE_LADDER.find(([n])=>n===selection.quantity)?.[1] ?? 0 : 0;
  const subtotalCents = unitCents * selection.quantity;
  // Reference bundle UI charges whole dollars (24 × $695 × 61% -> $10,175).
  const totalCents = selection.quantity > 1 ? Math.round(subtotalCents * (100-percent) / 10000) * 100 : unitCents;
  return {unitCents, subtotalCents, percent, discountCents:subtotalCents-totalCents,totalCents,currency:'usd' as const};
}
export function formatUsd(cents:number) {return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(cents/100);}
