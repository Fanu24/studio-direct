export const SALARY_CURRENCIES = ['USD','EUR','GBP','CHF','CAD','AUD','SGD','AED','JPY','HKD','INR','BRL','PLN','SEK','NOK','DKK','CZK','TRY','MXN','ZAR'] as const;
export type SalaryCurrency = typeof SALARY_CURRENCIES[number];
export const SALARY_PERIODS = ['yearly', 'monthly', 'hourly'] as const;
export type SalaryPeriod = typeof SALARY_PERIODS[number];
export const LANGUAGE_LEVELS = ['A1','A2','B1','B2','C1','C2','Native'] as const;
export type LanguageLevel = typeof LANGUAGE_LEVELS[number];
export const WORK_ARRANGEMENTS = ['remote', 'hybrid', 'onsite'] as const;
export type WorkArrangement = typeof WORK_ARRANGEMENTS[number];
export type LanguageRequirement = {code: string; level: LanguageLevel; kind: 'required' | 'preferred'};
export type GeoEligibility = {mode: 'geo'; regionIds: string[]; countryCodes: string[]};
export type TimezoneEligibility = {mode: 'timezone'; utcFrom: number; utcTo: number};
export type Eligibility = GeoEligibility | TimezoneEligibility;
export type ReferenceCity = {id: number; name: string; region: string; country_code: string; latitude: number; longitude: number; timezone: string};
export type ReferenceOption = {id: string; name: string; slug?: string; aliases?: string[]};

// Minutes avoid floating-point ambiguity and support half-hour and quarter-hour zones.
export const UTC_OFFSETS = Array.from({length: (14 * 60 - (-12 * 60)) / 30 + 1}, (_, index) => -12 * 60 + index * 30)
  .concat([345, 525, 765]).sort((a, b) => a - b);
export function formatUtcOffset(minutes: number): string {
  if (!UTC_OFFSETS.includes(minutes)) throw new Error('Choose a valid UTC offset.');
  const absolute = Math.abs(minutes);
  return `UTC${minutes < 0 ? '-' : '+'}${Math.floor(absolute / 60)}${absolute % 60 ? ':' + String(absolute % 60).padStart(2, '0') : ''}`;
}
export function eligibilitySatisfied(eligibility: Eligibility | null, candidate: {countryCode: string | null; utcOffset: number | null}): boolean {
  if (!eligibility) return true;
  if (eligibility.mode === 'geo') return !!candidate.countryCode && eligibility.countryCodes.includes(candidate.countryCode.toUpperCase());
  if (candidate.utcOffset === null) return false;
  return eligibility.utcFrom <= eligibility.utcTo
    ? candidate.utcOffset >= eligibility.utcFrom && candidate.utcOffset <= eligibility.utcTo
    : candidate.utcOffset >= eligibility.utcFrom || candidate.utcOffset <= eligibility.utcTo;
}
