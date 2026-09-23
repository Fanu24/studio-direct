import {PostingValidationError, validatePostingDraft, type Eligibility, type PostingDraft, type PostingErrors, type ReferenceCity} from '@gaming/shared';
import type {Database} from '../platform';
import {sanitizeJobDescriptionHtml} from '../jobs/sanitize-description';
import {decodeEntities} from '../jobs/meta';

export type CanonicalPosting = Omit<PostingDraft, 'eligibility'> & {descriptionText: string; companyDomain: string; cities: ReferenceCity[]; eligibility: Eligibility | null};
export async function parsePosting(db: Database, tenantId: string, raw: unknown): Promise<CanonicalPosting> {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  if (typeof record.descriptionHtml !== 'string' || record.descriptionHtml.length > 50000) throw new PostingValidationError({descriptionHtml: 'Enter a job description of up to 50,000 HTML characters.'});
  const descriptionHtml = sanitizeJobDescriptionHtml(record.descriptionHtml);
  const descriptionText = decodeEntities(descriptionHtml.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  const draft = validatePostingDraft({...record, descriptionHtml}, descriptionText), errors: PostingErrors = {};
  async function existingIds(table: 'skills' | 'benefits' | 'reference_languages', column: 'id' | 'slug' | 'code', ids: string[]) {
    if (!ids.length) return new Set<string>();
    const result = await db.prepare(`SELECT ${column} AS id FROM ${table} WHERE ${column} IN (SELECT value FROM json_each(?))${table === 'skills' ? " AND status='active'" : ''}`).bind(JSON.stringify(ids)).all<{id: string}>();
    return new Set(result.results.map(row => row.id));
  }
  const [skillIds, benefits, languages] = await Promise.all([
    existingIds('skills', 'id', [...draft.requiredSkillIds, ...draft.preferredSkillIds]),
    existingIds('benefits', 'slug', draft.benefitSlugs), existingIds('reference_languages', 'code', draft.languages.map(language => language.code)),
  ]);
  if (draft.requiredSkillIds.some(id => !skillIds.has(id))) errors.requiredSkillIds = 'Select active skills from the suggestions.';
  if (draft.preferredSkillIds.some(id => !skillIds.has(id))) errors.preferredSkillIds = 'Select active skills from the suggestions.';
  if (draft.benefitSlugs.some(id => !benefits.has(id))) errors.benefitSlugs = 'Select benefits from the suggestions.';
  if (draft.languages.some(language => !languages.has(language.code))) errors.languages = 'Select languages from the suggestions.';
  const cities = draft.cityIds.length ? (await db.prepare(`SELECT id,name,region,country_code,latitude,longitude,timezone FROM reference_cities
    WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(draft.cityIds)).all<ReferenceCity>()).results : [];
  if (cities.length !== draft.cityIds.length) errors.cityIds = 'Select cities from the suggestions.';
  let eligibility: Eligibility | null = draft.eligibility?.mode === 'timezone' ? draft.eligibility : null;
  if (draft.eligibility?.mode === 'geo') {
    const rows = (await db.prepare('SELECT id,country_codes_json FROM regions WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(draft.eligibility.regionIds)).all<{id: string; country_codes_json: string}>()).results;
    if (rows.length !== draft.eligibility.regionIds.length) errors.eligibility = 'Select eligibility from the suggested countries and regions.';
    else eligibility = {mode: 'geo', regionIds: draft.eligibility.regionIds, countryCodes: [...new Set(rows.flatMap(row => JSON.parse(row.country_codes_json) as string[]))].sort()};
  }
  const companyDomain = new URL(draft.companyUrl).hostname.replace(/^www\./, '').toLowerCase();
  if (draft.companyId) {
    const company = await db.prepare('SELECT name,domain FROM companies WHERE id=? AND tenant_id=? AND listed=1')
      .bind(draft.companyId, tenantId).first<{name: string; domain: string | null}>();
    if (!company) errors.companyId = 'Select an existing company or enter a new company name.';
    else if (company.domain && company.domain.toLowerCase().replace(/^www\./, '') !== companyDomain) errors.companyUrl = 'The website does not match the selected company. Contact support to correct it.';
    else draft.companyName = company.name;
  }
  if (Object.keys(errors).length) throw new PostingValidationError(errors);
  return {...draft, descriptionHtml, descriptionText, companyDomain, cities: draft.cityIds.map(id => cities.find(city => city.id === id)!), eligibility};
}
