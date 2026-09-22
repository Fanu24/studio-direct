import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {SKILL_SEEDS, BENEFIT_SEEDS, JOB_ROLE_SEEDS, validateReferenceTaxonomies} from '../packages/shared/src/product/taxonomy.ts';
import {buildReferenceRegions} from '../packages/shared/src/product/regions.ts';

// Generates reference-only SQL. Applying it always requires a separate explicit local/remote command.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = resolve(root, 'packages/db/reference');
const read = name => JSON.parse(readFileSync(resolve(base, name), 'utf8'));
const countries = read('countries.json').map(row => ({...row, name: row.name.trim()}));
const cities = read('cities.json'), languages = read('languages.json'), regions = buildReferenceRegions(countries);
const countryCodes = new Set(countries.map(row => row.code));
if (countries.length < 240 || cities.length < 20000 || languages.length < 180) throw Error('Reference data incomplete.');
if (new Set(cities.map(row => row.id)).size !== cities.length || cities.some(row => !countryCodes.has(row.country_code) || !row.timezone || !row.name)) throw Error('Invalid city identity.');
if (new Set(languages.map(row => row.code)).size !== languages.length || languages.some(row => !row.native_name)) throw Error('Invalid language reference.');
const languageManifest = read('languages-manifest.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (hash(readFileSync(resolve(base, 'languages.json'))) !== languageManifest.outputSha256) throw Error('Language provenance hash mismatch.');
const vocabulary = validateReferenceTaxonomies(), now = new Date().toISOString();
const quote = value => value === null ? 'NULL' : typeof value === 'number' ? (Number.isFinite(value) ? String(value) : (() => {throw Error('Invalid number');})()) : "'" + String(value).replaceAll("'", "''") + "'";
const statements = [];
function upsert(table, columns, keys, rows, update = columns.filter(column => !keys.includes(column))) {
  // Keep individual statements below D1's statement length limit.
  for (let i = 0; i < rows.length; i += 50) {
    const sql = `INSERT INTO ${table}(${columns.join(',')}) VALUES\n${rows.slice(i, i + 50).map(row => `(${row.map(quote).join(',')})`).join(',\n')}\nON CONFLICT(${keys.join(',')}) DO UPDATE SET ${update.map(column => `${column}=excluded.${column}`).join(',')};`;
    if (Buffer.byteLength(sql) > 90_000) throw Error('Reference import statement is too large.');
    statements.push(sql);
  }
}
upsert('reference_countries', ['code','name','continent'], ['code'], countries.map(row => [row.code,row.name,row.continent]));
upsert('reference_cities', ['id','name','search_name','region','country_code','latitude','longitude','timezone','population'], ['id'], cities.map(row => [row.id,row.name,row.search_name,row.region,row.country_code,row.latitude,row.longitude,row.timezone,row.population]));
upsert('reference_languages', ['code','name','native_name'], ['code'], languages.map(row => [row.code,row.name,row.native_name]));
upsert('regions', ['id','name','type','country_codes_json'], ['id'], regions.map(row => [row.id,row.name,row.type,JSON.stringify(row.countryCodes)]));
upsert('skills', ['id','slug','name','category','aliases_json','status','created_at'], ['id'], SKILL_SEEDS.map(row => [row.id,row.slug,row.name,row.category,JSON.stringify(row.aliases),'active',now]), ['slug','name','category','aliases_json']);
upsert('benefits', ['slug','label','aliases_json'], ['slug'], BENEFIT_SEEDS.map(row => [row.slug,row.name,JSON.stringify(row.aliases)]));
upsert('job_roles', ['id','name','slug','aliases_json','patterns_json'], ['id'], JOB_ROLE_SEEDS.map(row => [row.id,row.name,row.slug,JSON.stringify(row.aliases),JSON.stringify(row.patterns)]));
for (const [dataset, filename, source, count] of [
  ['countries','countries.json','https://download.geonames.org/export/dump/countryInfo.txt',countries.length],
  ['cities','cities.json','https://download.geonames.org/export/dump/cities15000.zip',cities.length],
  ['languages','languages.json',languageManifest.source,languages.length],
]) upsert('reference_imports', ['dataset','source_url','sha256','row_count','imported_at'], ['dataset'], [[dataset,source,hash(readFileSync(resolve(base,filename))),count,now]]);
const output = resolve(root, '.wrangler/reference-data/reference-import.sql');
mkdirSync(dirname(output), {recursive: true});
writeFileSync(output, '-- Nodework reference data only. No jobs, users, payments or feature activation.\n' + statements.join('\n') + '\n');
const receipt = {output, sha256: hash(readFileSync(output)), generatedAt: now, countries: countries.length, cities: cities.length, languages: languages.length, regions: regions.length, ...vocabulary};
writeFileSync(resolve(dirname(output), 'reference-import-receipt.json'), JSON.stringify(receipt,null,2) + '\n');
console.log(JSON.stringify(receipt));
