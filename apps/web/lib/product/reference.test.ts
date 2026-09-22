import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {testDatabase} from '../test-db';
import {searchReference} from './reference';
import {parsePosting} from './posting-input';
import {loadProductFlags} from './flags';
import {SKILL_SEEDS, BENEFIT_SEEDS} from '../../../../packages/shared/src/product/taxonomy';
import {readFileSync} from 'node:fs';

let fixture: ReturnType<typeof testDatabase>;
const description = 'Build reliable blockchain infrastructure, collaborate with security engineers, document design decisions and improve the reliability of our public APIs. You will review code, write meaningful integration tests and support releases.';
const draft = {title: 'Protocol Engineer', descriptionHtml: `<p>${description}</p>`, companyId: null, companyName: 'Example', companyUrl: 'https://example.com/',
  salaryMin: 100000, salaryMax: 150000, salaryCurrency: 'USD', salaryPeriod: 'yearly', cryptoPaymentAvailable: false,
  workArrangement: 'remote', cityIds: [], eligibility: {mode: 'geo', regionIds: ['country:IT','region:eu']}, requiredSkillIds: ['skill:rust'], preferredSkillIds: ['skill:go'],
  languages: [{code: 'en', level: 'C1', kind: 'required'}], benefitSlugs: ['health-insurance'], applyMode: 'redirect', applyUrl: 'https://example.com/careers/1', companyX: '', companyLinkedin: ''};
beforeEach(() => {
  fixture = testDatabase();
  for (const skill of SKILL_SEEDS) fixture.sql.prepare('INSERT INTO skills(id,slug,name,category,aliases_json,created_at) VALUES(?,?,?,?,?,?)').run(skill.id,skill.slug,skill.name,skill.category,JSON.stringify(skill.aliases),'2026-09-22');
  for (const benefit of BENEFIT_SEEDS) fixture.sql.prepare('INSERT OR IGNORE INTO benefits(slug,label) VALUES(?,?)').run(benefit.slug,benefit.name);
  fixture.sql.exec(`INSERT INTO reference_countries VALUES('IT','Italy','EU');
    INSERT INTO reference_languages VALUES('en','English','English'),('it','Italian','Italiano');
    INSERT INTO regions VALUES('country:IT','Italy','country','["IT"]'),('region:eu','EU','region','["IT","DE"]');
    INSERT INTO reference_cities VALUES(3173435,'Milan','milan','Lombardy','IT',45.46,9.18,'Europe/Rome',1300000);
    INSERT INTO companies(id,tenant_id,name,name_norm,domain,created_at) VALUES('example','tenant:gaming','Example','example','example.com','2026-09-22');`);
});
afterEach(() => fixture.sql.close());

describe('reference and canonical posting database boundaries', () => {
  it('finds aliases and never returns a pending skill or wildcard expansion', async () => {
    expect(await searchReference(fixture.db,'tenant:gaming','skills','golang')).toEqual([expect.objectContaining({id: 'skill:go', name: 'Go'})]);
    fixture.sql.exec("UPDATE skills SET status='pending' WHERE id='skill:go'");
    expect(await searchReference(fixture.db,'tenant:gaming','skills','golang')).toEqual([]);
    expect(await searchReference(fixture.db,'tenant:gaming','skills','%')).toEqual([]);
  });
  it('returns canonical cities and native language names, with tenant-scoped companies', async () => {
    expect(await searchReference(fixture.db,'tenant:gaming','cities','Mi')).toEqual([expect.objectContaining({id:3173435,country_code:'IT',timezone:'Europe/Rome'})]);
    expect(await searchReference(fixture.db,'tenant:gaming','cities','M')).toEqual([]);
    expect(await searchReference(fixture.db,'tenant:gaming','languages','Italiano')).toEqual([expect.objectContaining({code:'it'})]);
    expect(await searchReference(fixture.db,'other','companies','Example')).toEqual([]);
  });
  it('enforces skill/benefit separation for inserts and renames in both directions', () => {
    expect(() => fixture.sql.exec("INSERT INTO benefits(slug,label) VALUES('rust','Wrong')")).toThrow('skill');
    expect(() => fixture.sql.exec("UPDATE benefits SET slug='GO' WHERE slug='health-insurance'")).toThrow('skill');
    expect(() => fixture.sql.exec("UPDATE skills SET slug='HEALTH-INSURANCE' WHERE id='skill:rust'")).toThrow('benefit');
    expect(() => fixture.sql.exec("INSERT INTO skills(id,slug,name,category,created_at) VALUES('bad','health-insurance','Wrong','test','now')")).toThrow('benefit');
  });
  it('resolves overlapping regions on the server and removes executable markup', async () => {
    const parsed = await parsePosting(fixture.db,'tenant:gaming',{...draft,descriptionHtml: `<script>alert('bad')</script><p onclick="bad()">${description}</p>`});
    expect(parsed.eligibility).toEqual({mode:'geo',regionIds:['country:IT','region:eu'],countryCodes:['DE','IT']});
    expect(parsed.descriptionHtml).not.toContain('script'); expect(parsed.descriptionHtml).not.toContain('onclick');
    expect(parsed.descriptionText).toBe(description);
  });
  it('rejects invented cities, inactive skills and unknown regions', async () => {
    for (const patch of [{workArrangement:'onsite',cityIds:[999999999]}, {requiredSkillIds:['skill:invented']}, {eligibility:{mode:'geo',regionIds:['invalid']}}]) await expect(parsePosting(fixture.db,'tenant:gaming',{...draft,...patch})).rejects.toThrow();
  });
  it('does not trust client-supplied city coordinates, country lists or company identity', async () => {
    const parsed = await parsePosting(fixture.db,'tenant:gaming',{...draft,companyId:'example',companyName:'Impersonated',workArrangement:'onsite',cityIds:[3173435],cities:[{id:3173435,timezone:'Other'}]});
    expect(parsed.companyName).toBe('Example'); expect(parsed.cities[0].timezone).toBe('Europe/Rome');
    await expect(parsePosting(fixture.db,'other',{...draft,companyId:'example'})).rejects.toThrow();
    await expect(parsePosting(fixture.db,'tenant:gaming',{...draft,companyId:'example',companyUrl:'https://attacker.com'})).rejects.toThrow('website');
  });
  it('keeps flags off by default, enforces dependencies and permits an explicit kill switch', async () => {
    expect((await loadProductFlags(fixture.db,'tenant:gaming')).PRODUCT_POSTING_V2).toBe(false);
    fixture.sql.exec("INSERT INTO feature_flags VALUES('tenant:gaming','PRODUCT_COMPANY_CLAIMS',1,'now',NULL)");
    expect((await loadProductFlags(fixture.db,'tenant:gaming')).PRODUCT_COMPANY_CLAIMS).toBe(false);
    expect((await loadProductFlags(fixture.db,'tenant:gaming',{PRODUCT_POSTING_V2:'true'})).PRODUCT_COMPANY_CLAIMS).toBe(true);
    expect((await loadProductFlags(fixture.db,'tenant:gaming',{PRODUCT_POSTING_V2:'true',PRODUCT_COMPANY_CLAIMS:'false'})).PRODUCT_COMPANY_CLAIMS).toBe(false);
  });
  it('retains complete, unique canonical geographic and language snapshots', () => {
    const reference = new URL('../../../../packages/db/reference/', import.meta.url);
    const cities = JSON.parse(readFileSync(new URL('cities.json',reference),'utf8'));
    const languages = JSON.parse(readFileSync(new URL('languages.json',reference),'utf8'));
    expect(cities.length).toBeGreaterThan(20000); expect(new Set(cities.map((row: {id:number}) => row.id)).size).toBe(cities.length);
    expect(languages.find((row: {code:string})=>row.code==='it').native_name).toBe('Italiano');
  });
});
