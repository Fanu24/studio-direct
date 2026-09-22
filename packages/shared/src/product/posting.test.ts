import {describe, expect, it} from 'vitest';
import {PostingValidationError, publicHttpsUrl, validatePostingDraft} from './posting';
import {eligibilitySatisfied} from './fields';
import {resolveJobRole, validateReferenceTaxonomies} from './taxonomy';

const description = 'Build reliable blockchain infrastructure, collaborate with security engineers, document design decisions and improve the reliability of our public APIs. You will review code, write meaningful integration tests and support releases.';
const draft = {title: 'Protocol Engineer', descriptionHtml: `<p>${description}</p>`, companyId: null, companyName: 'Example', companyUrl: 'https://www.example.com/',
  salaryMin: 4000.50, salaryMax: 6000, salaryCurrency: 'EUR', salaryPeriod: 'monthly', cryptoPaymentAvailable: true,
  workArrangement: 'remote', cityIds: [], eligibility: {mode: 'geo', regionIds: ['region:eea']}, requiredSkillIds: ['skill:rust'], preferredSkillIds: [],
  languages: [{code: 'en', level: 'C1', kind: 'required'}], benefitSlugs: [], applyMode: 'email', applicationsEmail: 'Hiring@example.com', companyX: '', companyLinkedin: ''};

describe('structured native posting', () => {
  it('retains currency, period, fractional salary and normalizes a private email', () => {
    const parsed = validatePostingDraft(draft, description);
    expect(parsed).toMatchObject({salaryMin: 4000.50, salaryCurrency: 'EUR', salaryPeriod: 'monthly', applicationsEmail: 'hiring@example.com'});
  });
  it('returns multiple field errors and never silently truncates the title', () => {
    try {validatePostingDraft({...draft, title: 'a'.repeat(121), salaryMin: '', salaryMax: -1, companyUrl: 'http://example.com'}, 'short'); throw Error('Expected validation failure');}
    catch (error) {expect(error).toBeInstanceOf(PostingValidationError); expect((error as PostingValidationError).fields).toHaveProperty('title'); expect((error as PostingValidationError).fields).toHaveProperty('salaryMin'); expect((error as PostingValidationError).fields).toHaveProperty('descriptionHtml');}
  });
  it.each([{salaryMin: 10, salaryMax: 9}, {salaryMin: NaN}, {salaryMin: Infinity}, {salaryMin: 1.123}, {salaryCurrency: 'BTC'}, {salaryPeriod: 'weekly'}])('rejects invalid compensation %o', patch => {
    expect(() => validatePostingDraft({...draft, ...patch}, description)).toThrow(PostingValidationError);
  });
  it('rejects duplicate and overlapping skills and a fourth required skill', () => {
    for (const patch of [{requiredSkillIds: ['x','x']}, {requiredSkillIds: ['a','b','c','d']}, {preferredSkillIds: ['skill:rust']}]) expect(() => validatePostingDraft({...draft, ...patch}, description)).toThrow();
  });
  it('requires canonical city IDs for onsite work and removes hidden geographic fields', () => {
    expect(() => validatePostingDraft({...draft, workArrangement: 'onsite', cityIds: ['London']}, description)).toThrow();
    expect(validatePostingDraft({...draft, workArrangement: 'hybrid', cityIds: [2643743]}, description)).toMatchObject({cityIds: [2643743], eligibility: null});
    expect(validatePostingDraft({...draft, cityIds: [2643743]}, description).cityIds).toEqual([]);
  });
  it('supports half-hour UTC and wraparound ranges, but not arbitrary offsets', () => {
    const eligibility = {mode: 'timezone' as const, utcFrom: 330, utcTo: -300};
    expect(validatePostingDraft({...draft, eligibility}, description).eligibility).toEqual(eligibility);
    expect(eligibilitySatisfied(eligibility, {countryCode: null, utcOffset: 345})).toBe(true);
    expect(eligibilitySatisfied(eligibility, {countryCode: null, utcOffset: 0})).toBe(false);
    expect(() => validatePostingDraft({...draft, eligibility: {...eligibility, utcFrom: 17}}, description)).toThrow();
  });
  it('requires a language level and rejects duplicate or excessive language choices', () => {
    for (const languages of [[], [{code: 'en', level: 'fluent', kind: 'required'}], [...draft.languages, ...draft.languages]]) expect(() => validatePostingDraft({...draft, languages}, description)).toThrow();
  });
  it('keeps only the selected application destination and validates social hostnames', () => {
    const parsed = validatePostingDraft({...draft, applyMode: 'redirect', applyUrl: 'https://example.com/careers/1'}, description);
    expect(parsed.applicationsEmail).toBe('');
    expect(() => validatePostingDraft({...draft, companyX: 'https://x.com.attacker.org/example'}, description)).toThrow();
  });
  it.each(['javascript:alert(1)', 'http://example.com', 'https://user:secret@example.com', 'https://localhost/', 'https://127.0.0.1/', 'https://192.168.1.1/', 'https://[::1]/'])('rejects unsafe company/application URL %s', url => {
    expect(publicHttpsUrl(url)).toBeNull();
  });
  it('has sufficient separate reference vocabularies and maps specific role phrases', () => {
    const counts = validateReferenceTaxonomies(); expect(counts.skills).toBeGreaterThanOrEqual(300); expect(counts.benefits).toBeGreaterThanOrEqual(40); expect(counts.roles).toBeGreaterThanOrEqual(60);
    expect(resolveJobRole('Senior Technical Product Manager - DeFi')).toBe('role:technical-product-manager');
    expect(resolveJobRole('Principal Front-End Developer')).toBe('role:frontend-engineer');
    expect(resolveJobRole('Unclassified leader')).toBeNull();
  });
});
