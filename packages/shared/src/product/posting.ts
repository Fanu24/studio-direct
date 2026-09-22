import {LANGUAGE_LEVELS, SALARY_CURRENCIES, SALARY_PERIODS, UTC_OFFSETS, WORK_ARRANGEMENTS} from './fields';
import type {LanguageRequirement, SalaryCurrency, SalaryPeriod, WorkArrangement} from './fields';

export type PostingDraft = {
  title: string; descriptionHtml: string; companyId: string | null; companyName: string; companyUrl: string;
  salaryMin: number; salaryMax: number; salaryCurrency: SalaryCurrency; salaryPeriod: SalaryPeriod;
  cryptoPaymentAvailable: boolean; workArrangement: WorkArrangement; cityIds: number[];
  eligibility: {mode: 'geo'; regionIds: string[]} | {mode: 'timezone'; utcFrom: number; utcTo: number} | null;
  requiredSkillIds: string[]; preferredSkillIds: string[]; languages: LanguageRequirement[]; benefitSlugs: string[];
  applyMode: 'email' | 'redirect'; applyUrl: string; applicationsEmail: string; companyX: string; companyLinkedin: string;
};
export type PostingErrors = Partial<Record<keyof PostingDraft | 'form', string>>;
export class PostingValidationError extends Error {
  constructor(public readonly fields: PostingErrors) {super(Object.values(fields)[0] ?? 'Check the job details.'); this.name = 'PostingValidationError';}
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function publicHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.')
      || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname) || url.hostname.startsWith('[')
      || /\.(localhost|local|internal|test|invalid)$/.test(url.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)) return null;
    url.hash = ''; return url.href;
  } catch {return null;}
}
/** Structural validation is shared with the form. Canonical IDs and HTML are checked again on the server. */
export function validatePostingDraft(raw: unknown, descriptionText: string): PostingDraft {
  const r = record(raw), errors: PostingErrors = {};
  const text = (key: string) => typeof r[key] === 'string' ? String(r[key]).trim() : '';
  const title = text('title'), companyName = text('companyName'), companyUrl = publicHttpsUrl(r.companyUrl);
  if (title.length < 3 || title.length > 120) errors.title = 'Enter a job title between 3 and 120 characters.';
  if (descriptionText.replace(/\s+/g, ' ').trim().length < 200 || text('descriptionHtml').length > 50000) errors.descriptionHtml = 'Describe the job in at least 200 characters (maximum 50,000 HTML characters).';
  if (companyName.length < 2 || companyName.length > 160) errors.companyName = 'Enter a company name between 2 and 160 characters.';
  if (r.companyId != null && (typeof r.companyId !== 'string' || !r.companyId.trim() || r.companyId.length > 200)) errors.companyId = 'Choose a valid company.';
  if (!companyUrl) errors.companyUrl = 'Enter a public company website beginning with https://.';
  const validSalary = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001;
  if (!validSalary(r.salaryMin)) errors.salaryMin = 'Enter a valid minimum salary with up to two decimal places.';
  if (!validSalary(r.salaryMax) || (validSalary(r.salaryMin) && Number(r.salaryMax) < r.salaryMin)) errors.salaryMax = 'The maximum salary must be at least the minimum.';
  if (!(SALARY_CURRENCIES as readonly unknown[]).includes(r.salaryCurrency)) errors.salaryCurrency = 'Choose a supported salary currency.';
  if (!(SALARY_PERIODS as readonly unknown[]).includes(r.salaryPeriod)) errors.salaryPeriod = 'Choose yearly, monthly or hourly pay.';
  if (typeof r.cryptoPaymentAvailable !== 'boolean') errors.cryptoPaymentAvailable = 'Choose whether crypto payment is available.';
  if (!(WORK_ARRANGEMENTS as readonly unknown[]).includes(r.workArrangement)) errors.workArrangement = 'Choose a work arrangement.';
  const strings = (key: 'requiredSkillIds' | 'preferredSkillIds' | 'benefitSlugs', min: number, max: number) => {
    const value = r[key];
    if (!Array.isArray(value) || value.length < min || value.length > max || value.some(id => typeof id !== 'string' || !id || id.length > 150) || new Set(value).size !== value.length) {
      errors[key] = `Choose ${min ? `${min} to ` : 'up to '}${max} distinct items.`; return [] as string[];
    }
    return value as string[];
  };
  const requiredSkillIds = strings('requiredSkillIds', 1, 3), preferredSkillIds = strings('preferredSkillIds', 0, 12), benefitSlugs = strings('benefitSlugs', 0, 40);
  if (preferredSkillIds.some(id => requiredSkillIds.includes(id))) errors.preferredSkillIds = 'A required skill cannot also be preferred.';
  let cityIds: number[] = [], eligibility: PostingDraft['eligibility'] = null;
  if (r.workArrangement === 'remote') {
    const e = record(r.eligibility);
    if (e.mode === 'geo') {
      if (!Array.isArray(e.regionIds) || !e.regionIds.length || e.regionIds.length > 280 || e.regionIds.some(id => typeof id !== 'string' || !id || id.length > 100) || new Set(e.regionIds).size !== e.regionIds.length) errors.eligibility = 'Choose distinct countries or regions.';
      else eligibility = {mode: 'geo', regionIds: e.regionIds as string[]};
    } else if (e.mode === 'timezone') {
      if (!UTC_OFFSETS.includes(e.utcFrom as number) || !UTC_OFFSETS.includes(e.utcTo as number)) errors.eligibility = 'Choose a valid UTC offset for both boundaries.';
      else eligibility = {mode: 'timezone', utcFrom: e.utcFrom as number, utcTo: e.utcTo as number};
    } else errors.eligibility = 'Choose geographic eligibility or a UTC range.';
  } else if (r.workArrangement === 'hybrid' || r.workArrangement === 'onsite') {
    if (!Array.isArray(r.cityIds) || !r.cityIds.length || r.cityIds.length > 5 || r.cityIds.some(id => typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) || new Set(r.cityIds).size !== r.cityIds.length) errors.cityIds = 'Select 1 to 5 distinct cities from the suggestions.';
    else cityIds = r.cityIds as number[];
  }
  const languages: LanguageRequirement[] = [];
  if (!Array.isArray(r.languages) || !r.languages.length || r.languages.length > 3) errors.languages = 'Choose 1 to 3 languages and their required level.';
  else for (const rawLanguage of r.languages) {
    const language = record(rawLanguage);
    if (typeof language.code !== 'string' || !/^[a-z]{2}$/.test(language.code) || !(LANGUAGE_LEVELS as readonly unknown[]).includes(language.level)
      || !['required', 'preferred'].includes(String(language.kind)) || languages.some(item => item.code === language.code)) errors.languages = 'Choose distinct languages, levels and required/preferred status.';
    else languages.push(language as LanguageRequirement);
  }
  const applyUrl = r.applyMode === 'redirect' ? publicHttpsUrl(r.applyUrl) : '', applicationsEmail = r.applyMode === 'email' ? text('applicationsEmail').toLowerCase() : '';
  if (r.applyMode !== 'email' && r.applyMode !== 'redirect') errors.applyMode = 'Choose how candidates apply.';
  if (r.applyMode === 'redirect' && !applyUrl) errors.applyUrl = 'Enter a public https:// application URL.';
  if (r.applyMode === 'email' && (applicationsEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicationsEmail))) errors.applicationsEmail = 'Enter a valid applications email.';
  const social = (key: 'companyX' | 'companyLinkedin', hosts: string[]) => {
    if (!text(key)) return '';
    const url = publicHttpsUrl(r[key]);
    if (!url || !hosts.includes(new URL(url).hostname.replace(/^www\./, '')) || new URL(url).pathname === '/') {errors[key] = 'Enter the company profile URL.'; return '';}
    return url;
  };
  const companyX = social('companyX', ['x.com', 'twitter.com']), companyLinkedin = social('companyLinkedin', ['linkedin.com']);
  if (Object.keys(errors).length) throw new PostingValidationError(errors);
  return {title, descriptionHtml: text('descriptionHtml'), companyId: typeof r.companyId === 'string' ? r.companyId.trim() : null,
    companyName, companyUrl: companyUrl!, salaryMin: r.salaryMin as number, salaryMax: r.salaryMax as number, salaryCurrency: r.salaryCurrency as SalaryCurrency,
    salaryPeriod: r.salaryPeriod as SalaryPeriod, cryptoPaymentAvailable: r.cryptoPaymentAvailable as boolean,
    workArrangement: r.workArrangement as WorkArrangement, cityIds, eligibility, requiredSkillIds, preferredSkillIds, languages, benefitSlugs,
    applyMode: r.applyMode as PostingDraft['applyMode'], applyUrl: applyUrl ?? '', applicationsEmail, companyX, companyLinkedin};
}
