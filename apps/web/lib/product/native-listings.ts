import {JOB_ACCESS_SQL} from './job-access';
import {resolveJobRole,formatUtcOffset,resolveJobLocations,type JobAddons} from '@gaming/shared';
import type {Database,Statement} from '../platform';
import {parsePosting,type CanonicalPosting} from './posting-input';

export type PostingChoices={company:Choice[];cities:Choice[];regions:Choice[];requiredSkills:Choice[];preferredSkills:Choice[];languages:Choice[];benefits:Choice[]};
type Choice={id:string|number;name:string;domain?:string|null;region?:string;country_name?:string;native_name?:string};
export async function ownedNativeListing(db:Database,userId:string,id:string){
  const row=await db.prepare(`SELECT d.input_json,d.addons_json,j.tenant_id,j.slug,o.status FROM native_listing_details d
    JOIN jobs j ON j.id=d.job_id JOIN employer_listings l ON l.job_id=j.id JOIN employer_orders o ON o.id=l.order_id
    WHERE j.id=? AND ${JOB_ACCESS_SQL}`).bind(id,userId,userId).first<{input_json:string;addons_json:string;tenant_id:string;slug:string;status:string}>();
  if(!row)return null;
  const input=JSON.parse(row.input_json) as CanonicalPosting;
  const choices=await postingChoices(db,input);
  return {input,addons:JSON.parse(row.addons_json) as JobAddons,choices,tenantId:row.tenant_id,slug:row.slug,status:row.status};
}

export async function postingChoices(db:Database,input:CanonicalPosting){
  const choices:PostingChoices={company:[{id:input.companyId!,name:input.companyName,domain:input.companyDomain}],cities:(input.cities??[]).map(city=>({...city,country_name:city.country_code})),regions:[],requiredSkills:[],preferredSkills:[],languages:[],benefits:[]};
  const [skills,languages,benefits,regions]=await Promise.all([
    db.prepare('SELECT id,name FROM skills WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify([...input.requiredSkillIds,...input.preferredSkillIds])).all<Choice>(),
    db.prepare('SELECT code AS id,name,native_name FROM reference_languages WHERE code IN (SELECT value FROM json_each(?))').bind(JSON.stringify(input.languages.map(l=>l.code))).all<Choice>(),
    db.prepare('SELECT slug AS id,label AS name FROM benefits WHERE slug IN (SELECT value FROM json_each(?))').bind(JSON.stringify(input.benefitSlugs)).all<Choice>(),
    db.prepare('SELECT id,name FROM regions WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(input.eligibility?.mode==='geo'?input.eligibility.regionIds??[]:[])).all<Choice>(),
  ]);
  choices.requiredSkills=skills.results.filter(s=>input.requiredSkillIds.includes(String(s.id)));choices.preferredSkills=skills.results.filter(s=>input.preferredSkillIds.includes(String(s.id)));
  choices.languages=languages.results;choices.benefits=benefits.results;choices.regions=regions.results;
  return choices;
}

export async function nativeLocation(db:Database,input:CanonicalPosting){
  if(input.workArrangement!=='remote'){
    const countries=await db.prepare('SELECT code,name FROM reference_countries WHERE code IN (SELECT value FROM json_each(?))').bind(JSON.stringify(input.cities.map(c=>c.country_code))).all<{code:string;name:string}>();
    return input.cities.map(city=>`${city.name}, ${countries.results.find(c=>c.code===city.country_code)?.name??city.country_code}`).join(' / ');
  }
  if(input.eligibility?.mode==='timezone')return `Remote · ${formatUtcOffset(input.eligibility.utcFrom)} to ${formatUtcOffset(input.eligibility.utcTo)}`;
  const regions=await db.prepare('SELECT name FROM regions WHERE id IN (SELECT value FROM json_each(?)) ORDER BY name').bind(JSON.stringify(input.eligibility?.mode==='geo'?input.eligibility.regionIds??[]:[])).all<{name:string}>();
  return 'Remote'+(regions.results.length?' · '+regions.results.map(r=>r.name).join(', '):'');
}
export function nativeSalaryText(input:CanonicalPosting,hide:boolean){
  if(hide)return 'Not disclosed';
  const format=new Intl.NumberFormat('en-US',{style:'currency',currency:input.salaryCurrency,maximumFractionDigits:2});
  return `${format.format(input.salaryMin)} – ${format.format(input.salaryMax)} ${input.salaryPeriod}`;
}

/** These relations participate in the publication/edit transaction; never erase billing/placement. */
export function nativeFacetStatements(db:Database,jobId:string,input:CanonicalPosting,location:string,guard:string,values:unknown[]):Statement[]{
  const result:Statement[]=[];
  for(const table of ['job_skills','job_tags','job_cities','job_locations','job_language_requirements','job_benefits','job_remote_eligibility'])result.push(db.prepare(`DELETE FROM ${table} WHERE job_id=? AND ${guard}`).bind(jobId,...values));
  for(const [kind,skills] of [['required',input.requiredSkillIds],['preferred',input.preferredSkillIds]] as const)for(const skillId of skills){
    result.push(db.prepare(`INSERT OR IGNORE INTO job_skills(job_id,skill_id,kind) SELECT ?,?,? WHERE ${guard}`).bind(jobId,skillId,kind,...values));
    result.push(db.prepare(`INSERT OR IGNORE INTO tags(slug,label) SELECT slug,name FROM skills WHERE id=? AND ${guard}`).bind(skillId,...values));
    result.push(db.prepare(`INSERT OR IGNORE INTO job_tags(job_id,tag_slug) SELECT ?,slug FROM skills WHERE id=? AND ${guard}`).bind(jobId,skillId,...values));
  }
  for(const {slug} of resolveJobLocations(location.replace(/^Remote · /,''))){
    result.push(db.prepare(`INSERT OR IGNORE INTO job_locations(job_id,location_slug) SELECT ?,? WHERE ${guard}`).bind(jobId,slug,...values));
  }
  for(const city of input.cities)result.push(db.prepare(`INSERT OR IGNORE INTO job_cities(job_id,city_id) SELECT ?,? WHERE ${guard}`).bind(jobId,city.id,...values));
  for(const language of input.languages)result.push(db.prepare(`INSERT OR IGNORE INTO job_language_requirements(job_id,language_code,level,kind) SELECT ?,?,?,? WHERE ${guard}`).bind(jobId,language.code,language.level,language.kind,...values));
  for(const benefit of input.benefitSlugs)result.push(db.prepare(`INSERT OR IGNORE INTO job_benefits(job_id,benefit_slug) SELECT ?,? WHERE ${guard}`).bind(jobId,benefit,...values));
  if(input.eligibility)result.push(db.prepare(`INSERT OR IGNORE INTO job_remote_eligibility(job_id,mode,rules_json) SELECT ?,?,? WHERE ${guard}`).bind(jobId,input.eligibility.mode,JSON.stringify(input.eligibility),...values));
  return result;
}

export async function editNativeListing(db:Database,userId:string,id:string,raw:unknown,now=new Date()){
  const existing=await ownedNativeListing(db,userId,id);if(!existing||existing.status!=='paid')throw Error('Paid listing not found.');
  const input=await parsePosting(db,existing.tenantId,raw);
  if(input.companyId!==existing.input.companyId||input.companyDomain!==existing.input.companyDomain)throw Error('Changing the company requires support review.');
  const location=await nativeLocation(db,input),guard=`EXISTS(SELECT 1 FROM employer_listings l JOIN employer_orders o ON o.id=l.order_id JOIN jobs j ON j.id=l.job_id WHERE l.job_id=? AND ${JOB_ACCESS_SQL} AND o.status='paid')`,values=[id,userId,userId];
  await db.batch([
    db.prepare(`UPDATE jobs SET title=?,title_norm=?,description_html=?,description_text=?,location=?,remote=?,salary_text=?,salary_min=?,salary_max=?,salary_currency=?,salary_period=?,crypto_payment_available=?,apply_url=?,updated_at=? WHERE id=? AND ${guard}`)
      .bind(input.title,input.title.toLowerCase(),input.descriptionHtml,input.descriptionText,location,input.workArrangement,nativeSalaryText(input,existing.addons.hideSalary),input.salaryMin,input.salaryMax,input.salaryCurrency,input.salaryPeriod,input.cryptoPaymentAvailable?1:0,input.applyMode==='redirect'?input.applyUrl:`/jobs/${existing.slug}/apply`,now.toISOString(),id,...values),
    db.prepare(`UPDATE native_listing_details SET input_json=?,updated_at=? WHERE job_id=? AND ${guard}`).bind(JSON.stringify(input),now.toISOString(),id,...values),
    db.prepare(`UPDATE employer_listings SET apply_mode=?,contact_email=? WHERE job_id=? AND ${guard}`).bind(input.applyMode==='email'?'internal':'external',input.applicationsEmail,id,...values),
    ...nativeFacetStatements(db,id,input,location,guard,values),
  ]);
  await assignNativeRole(db,id,input.title);
  return existing.slug;
}

export async function assignNativeRole(db:Database,jobId:string,title:string){const roles=await db.prepare('SELECT id,name,slug,aliases_json,patterns_json FROM job_roles').bind().all<{id:string;name:string;slug:string;aliases_json:string;patterns_json:string}>();const role=resolveJobRole(title,roles.results.map(r=>({...r,aliases:JSON.parse(r.aliases_json),patterns:JSON.parse(r.patterns_json)})));await db.prepare('UPDATE jobs SET job_role_id=? WHERE id=?').bind(role,jobId).run();}
