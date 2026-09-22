import type {Database} from '../platform';

export const REFERENCE_KINDS = ['cities','regions','skills','benefits','languages','companies'] as const;
export type ReferenceKind = typeof REFERENCE_KINDS[number];
const escapeLike = (value: string) => value.replace(/[\\%_]/g, character => `\\${character}`);
export const normalizeSearch = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export async function searchReference(db: Database, tenantId: string, kind: ReferenceKind, query: string) {
  if (typeof query !== 'string' || query.length > 100) throw new Error('Search is too long.');
  const input = query.trim(), anywhere = `%${escapeLike(input.toLowerCase())}%`, prefix = `${escapeLike(normalizeSearch(input))}%`;
  if (kind === 'cities') {
    if (input.length < 2) return [];
    return (await db.prepare(`SELECT c.id,c.name,c.region,c.country_code,c.latitude,c.longitude,c.timezone,n.name AS country_name
      FROM reference_cities c JOIN reference_countries n ON n.code=c.country_code
      WHERE c.search_name LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\'
      ORDER BY c.population DESC,c.name,c.id LIMIT 20`).bind(prefix, `${escapeLike(input)}%`).all()).results;
  }
  if (kind === 'regions') return (await db.prepare(`SELECT id,name,type,country_codes_json FROM regions
    WHERE name LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\'
    ORDER BY CASE WHEN id='region:worldwide' THEN 0 WHEN type='continent' THEN 1 WHEN type='region' THEN 2 ELSE 3 END,name LIMIT 280`).bind(anywhere, anywhere).all()).results;
  if (kind === 'skills') return (await db.prepare(`SELECT id,name,slug,category FROM skills s WHERE status='active' AND
    (name LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM json_each(s.aliases_json) a WHERE a.value LIKE ? ESCAPE '\\'))
    ORDER BY CASE WHEN lower(name)=? THEN 0 ELSE 1 END,name LIMIT 30`).bind(anywhere, anywhere, input.toLowerCase()).all()).results;
  if (kind === 'benefits') return (await db.prepare(`SELECT slug AS id,label AS name,slug FROM benefits b WHERE label LIKE ? ESCAPE '\\'
    OR EXISTS(SELECT 1 FROM json_each(b.aliases_json) a WHERE a.value LIKE ? ESCAPE '\\') ORDER BY label LIMIT 100`).bind(anywhere, anywhere).all()).results;
  if (kind === 'languages') return (await db.prepare(`SELECT code AS id,code,name,native_name FROM reference_languages
    WHERE name LIKE ? ESCAPE '\\' OR native_name LIKE ? ESCAPE '\\' OR code=? ORDER BY name LIMIT 200`).bind(anywhere, anywhere, input.toLowerCase()).all()).results;
  if (kind === 'companies') return (await db.prepare(`SELECT id,name,domain,logo_url FROM companies
    WHERE tenant_id=? AND listed=1 AND name LIKE ? ESCAPE '\\' ORDER BY name LIMIT 20`).bind(tenantId, anywhere).all()).results;
  throw new Error('Unknown reference catalogue.');
}
