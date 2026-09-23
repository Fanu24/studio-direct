import {candidateCompleteness,containsDirectContact,publicCandidateText,publicHttpsUrl,LANGUAGE_LEVELS,UTC_OFFSETS,WORK_ARRANGEMENTS,type MatchProfile} from '@gaming/shared';
import type {Database,Statement} from '../platform';

export type CandidateProfile={user_id:string;handle:string|null;display_name:string|null;headline:string|null;target_role:string|null;photo_url:string|null;city_id:number|null;country_code:string|null;location:string|null;utc_offset:number|null;availability:string;remote_pref:string|null;open_to_crypto:number;public_profile:number;talent_pool_opt_in:number;featured_opt_in:number;verified_at:string|null;cv_r2_key:string|null;bio:string|null;completeness:number;product_profile_completed:number};
export type CandidateDetails={profile:CandidateProfile|null;skills:{id:string;name:string}[];languages:{code:string;name:string;level:string}[];links:{kind:string;url:string}[];experience:{id:string;company:string;title:string;start_date:string|null;end_date:string|null;description:string|null}[];city:{id:number;name:string;region:string;country_name:string}|null};
export async function candidateDetails(db:Database,userId:string):Promise<CandidateDetails>{
  const [profile,skills,languages,links,experience]=await Promise.all([
    db.prepare('SELECT * FROM profiles WHERE user_id=?').bind(userId).first<CandidateProfile>(),
    db.prepare('SELECT s.id,s.name FROM candidate_skills c JOIN skills s ON s.id=c.skill_id WHERE c.user_id=? ORDER BY s.name').bind(userId).all<CandidateDetails['skills'][number]>(),
    db.prepare('SELECT c.language_code AS code,l.name,c.level FROM candidate_languages c JOIN reference_languages l ON l.code=c.language_code WHERE c.user_id=? ORDER BY l.name').bind(userId).all<CandidateDetails['languages'][number]>(),
    db.prepare('SELECT kind,url FROM candidate_links WHERE user_id=? ORDER BY kind').bind(userId).all<CandidateDetails['links'][number]>(),
    db.prepare('SELECT id,company,title,start_date,end_date,description FROM experience_entries WHERE user_id=? ORDER BY start_date DESC,id').bind(userId).all<CandidateDetails['experience'][number]>(),
  ]);
  const city=profile?.city_id?await db.prepare('SELECT c.id,c.name,c.region,n.name AS country_name FROM reference_cities c JOIN reference_countries n ON n.code=c.country_code WHERE c.id=?').bind(profile.city_id).first<CandidateDetails['city']>():null;
  return {profile,skills:skills.results,languages:languages.results,links:links.results,experience:experience.results,city};
}
export function candidateMatchProfile(details:CandidateDetails):MatchProfile{return {skillIds:details.skills.map(s=>s.id),languages:details.languages,countryCode:details.profile?.country_code??null,utcOffset:details.profile?.utc_offset??null};}
export function profileCompleteness(details:CandidateDetails){return candidateCompleteness({photo:details.profile?.photo_url,headline:details.profile?.headline,location:details.profile?.location,skills:details.skills.length,languages:details.languages.length,experiences:details.experience.length,cv:details.profile?.cv_r2_key,links:details.links.length});}
export async function refreshCandidateCompleteness(db:Database,userId:string){const result=profileCompleteness(await candidateDetails(db,userId));await db.prepare('UPDATE profiles SET completeness=? WHERE user_id=? AND product_profile_completed=1').bind(result.score,userId).run();return result;}
export async function candidatePremium(db:Database,userId:string,now=new Date()){
  return !!await db.prepare("SELECT user_id FROM candidate_subscriptions WHERE user_id=? AND status IN ('active','trialing') AND renews_at>?").bind(userId,now.toISOString()).first();
}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid profile.');return value as Record<string,unknown>;}
const publicText=(value:unknown,max:number,required=false)=>{const s=typeof value==='string'?value.trim():'';if(s.length>max||(required&&!s)||containsDirectContact(s))throw Error('Check your public text: direct contact details are not allowed. Use the social links below.');return s;};
export async function saveCandidateProfile(db:Database,userId:string,raw:unknown,now=new Date()){
  const r=object(raw),handle=String(r.handle??'').trim().toLowerCase();
  if(!/^[a-z][a-z0-9-]{2,39}$/.test(handle)||['admin','account','api','support','featured','settings','login','new'].includes(handle))throw Error('Choose a handle of 3–40 lowercase letters, numbers or hyphens, starting with a letter.');
  const conflict=await db.prepare('SELECT user_id FROM profiles WHERE handle=? AND user_id<>?').bind(handle,userId).first();if(conflict)throw Error('This handle is already in use.');
  const name=publicText(r.displayName,100,true),headline=publicText(r.headline,80,true),bio=publicText(r.bio,3000);
  if(!(WORK_ARRANGEMENTS as readonly unknown[]).includes(r.workArrangement)||!['open_to_work','open_to_contracts','not_looking'].includes(String(r.availability)))throw Error('Choose your work preferences.');
  if(r.utcOffset!==null&&!UTC_OFFSETS.includes(r.utcOffset as number))throw Error('Choose a valid UTC offset.');
  for(const key of ['publicProfile','discoverable','featuredOptIn','openToCrypto'])if(typeof r[key]!=='boolean')throw Error('Review your privacy and work preferences.');
  const city=r.cityId===null?null:await db.prepare('SELECT id,name,region,country_code FROM reference_cities WHERE id=?').bind(r.cityId).first<{id:number;name:string;region:string;country_code:string}>();
  if(r.cityId!==null&&!city)throw Error('Select a city from the suggestions.');
  const country=city?.country_code??String(r.countryCode??'');
  const countryRow=await db.prepare('SELECT name FROM reference_countries WHERE code=?').bind(country).first<{name:string}>();if(!countryRow)throw Error('Choose your country.');
  const skillIds=Array.isArray(r.skillIds)?r.skillIds:[];
  if(skillIds.length>30||skillIds.some(id=>typeof id!=='string')||new Set(skillIds).size!==skillIds.length)throw Error('Choose up to 30 distinct skills.');
  const skills=await db.prepare("SELECT id FROM skills WHERE status='active' AND id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(skillIds)).all<{id:string}>();if(skills.results.length!==skillIds.length)throw Error('Choose active skills from the suggestions.');
  const languages=Array.isArray(r.languages)?r.languages.map(object):[];if(languages.length>20||new Set(languages.map(l=>l.code)).size!==languages.length)throw Error('Choose distinct languages.');
  const refs=await db.prepare('SELECT code FROM reference_languages WHERE code IN (SELECT value FROM json_each(?))').bind(JSON.stringify(languages.map(l=>l.code))).all<{code:string}>();
  if(refs.results.length!==languages.length||languages.some(l=>!(LANGUAGE_LEVELS as readonly unknown[]).includes(l.level)))throw Error('Choose valid languages and levels.');
  const links=Array.isArray(r.links)?r.links.map(object):[];if(links.length>4||new Set(links.map(l=>l.kind)).size!==links.length)throw Error('Choose one URL per social profile.');
  const hosts:Record<string,string[]|null>={github:['github.com'],x:['x.com','twitter.com'],linkedin:['linkedin.com'],portfolio:null};
  for(const link of links){const kind=String(link.kind),url=publicHttpsUrl(link.url);if(!(kind in hosts)||!url||containsDirectContact(url))throw Error('Use public HTTPS profile links.');const parsed=new URL(url);if(hosts[kind]&&!hosts[kind]!.includes(parsed.hostname.replace(/^www\./,'')))throw Error('Check the social profile domain.');if(['wa.me','t.me','api.whatsapp.com','discord.gg','calendly.com'].includes(parsed.hostname.replace(/^www\./,'')))throw Error('Direct contact links are not public profile links.');link.url=url;}
  const experience=Array.isArray(r.experience)?r.experience.map(object):[];if(experience.length>30)throw Error('Add up to 30 experience entries.');
  for(const e of experience){e.company=publicText(e.company,160,true);e.title=publicText(e.title,120,true);e.description=publicText(e.description,1200);for(const key of ['startDate','endDate'])if(e[key]&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(e[key])))throw Error('Use valid month/year experience dates.');if(e.startDate&&e.endDate&&String(e.endDate)<String(e.startDate))throw Error('Experience end date precedes start date.');}
  const current=await db.prepare('SELECT cv_r2_key,photo_url FROM profiles WHERE user_id=?').bind(userId).first<{cv_r2_key:string|null;photo_url:string|null}>();
  const photo=current?.photo_url??null,location=city?`${city.name}, ${city.region}, ${countryRow.name}`:`Remote from ${countryRow.name}`;
  const completeness=candidateCompleteness({photo,headline,location,skills:skillIds.length,languages:languages.length,experiences:experience.length,cv:current?.cv_r2_key,links:links.length}).score;
  const at=now.toISOString(),statements:Statement[]=[db.prepare(`INSERT INTO profiles(user_id,handle,display_name,headline,bio,city_id,country_code,location,utc_offset,availability,remote_pref,open_to_crypto,public_profile,talent_pool_opt_in,featured_opt_in,completeness,last_active_at,product_profile_completed,target_role)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle,display_name=excluded.display_name,headline=excluded.headline,bio=excluded.bio,city_id=excluded.city_id,country_code=excluded.country_code,location=excluded.location,utc_offset=excluded.utc_offset,availability=excluded.availability,remote_pref=excluded.remote_pref,open_to_crypto=excluded.open_to_crypto,public_profile=excluded.public_profile,talent_pool_opt_in=excluded.talent_pool_opt_in,featured_opt_in=excluded.featured_opt_in,completeness=excluded.completeness,last_active_at=excluded.last_active_at,product_profile_completed=1`)
    .bind(userId,handle,name,headline,bio,city?.id??null,country,location,r.utcOffset,r.availability,r.workArrangement,r.openToCrypto?1:0,r.publicProfile?1:0,r.discoverable?1:0,r.featuredOptIn?1:0,completeness,at,headline)];
  for(const table of ['candidate_skills','candidate_languages','candidate_links','experience_entries'])statements.push(db.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(userId));
  for(const id of skillIds)statements.push(db.prepare('INSERT INTO candidate_skills VALUES(?,?)').bind(userId,id));
  for(const l of languages)statements.push(db.prepare('INSERT INTO candidate_languages VALUES(?,?,?)').bind(userId,l.code,l.level));
  for(const l of links)statements.push(db.prepare('INSERT INTO candidate_links VALUES(?,?,?)').bind(userId,l.kind,l.url));
  for(const e of experience)statements.push(db.prepare('INSERT INTO experience_entries(id,user_id,company,title,start_date,end_date,description) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),userId,e.company,e.title,e.startDate||null,e.endDate||null,e.description));
  for(const [kind,value] of [['public_profile',r.publicProfile],['talent_pool',r.discoverable],['featured',r.featuredOptIn]])statements.push(db.prepare('INSERT INTO consent_events(id,user_id,kind,value,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),userId,kind,value?'1':'0',at));
  await db.batch(statements);return {handle,completeness};
}
export function publicCandidate(details:CandidateDetails){const p=details.profile;if(!p)return null;return {id:p.user_id,handle:p.handle??p.user_id,name:publicCandidateText(p.display_name),headline:publicCandidateText(p.headline),bio:publicCandidateText(p.bio),photo:p.photo_url,location:p.location,availability:p.availability,verified:!!p.verified_at,openToCrypto:!!p.open_to_crypto,skills:details.skills,languages:details.languages,links:details.links,experience:details.experience.map(e=>({...e,company:publicCandidateText(e.company),title:publicCandidateText(e.title),description:publicCandidateText(e.description)}))};}
