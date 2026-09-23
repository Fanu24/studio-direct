import {publicCandidateText} from '@gaming/shared';
import type {Database} from './platform';
import {hasRecruiterAccess} from './billing/marketplace';
export type Talent={user_id:string;display_name:string|null;headline:string|null;target_role:string|null;location:string|null;salary_min:number|null;salary_max:number|null;experience_years:number|null;languages:string|null;skills:string|null;bio:string|null;website:string|null};
export type TalentFilters={skill?:string;location?:string;query?:string;page?:number;language?:string;experience?:number;salaryMax?:number};
export function talentWhere(filters:TalentFilters,privileged=false,exportOnly=false){
 const clauses=[exportOnly?'p.talent_pool_opt_in=1 AND p.talent_export_opt_in=1':privileged?'(p.public_profile=1 OR p.talent_pool_opt_in=1)':'p.public_profile=1'],values:unknown[]=[];
 if(filters.skill){clauses.push('(EXISTS(SELECT 1 FROM candidate_skills cs JOIN skills s ON s.id=cs.skill_id WHERE cs.user_id=p.user_id AND (s.slug=? OR s.id=?)) OR (p.product_profile_completed=0 AND EXISTS(SELECT 1 FROM profile_skills s WHERE s.user_id=p.user_id AND s.skill=?)))');values.push(filters.skill,filters.skill,filters.skill);}
 if(filters.location){clauses.push("LOWER(p.location) LIKE ? ESCAPE '\\'");values.push('%'+filters.location.replaceAll('-',' ').toLowerCase().replace(/[\\%_]/g,'\\$&')+'%');}
 if(filters.query){clauses.push("(p.target_role LIKE ? ESCAPE '\\' OR p.headline LIKE ? ESCAPE '\\')");const like='%'+filters.query.slice(0,100).replace(/[\\%_]/g,'\\$&')+'%';values.push(like,like);}
 if(filters.language){clauses.push("LOWER(p.languages) LIKE ? ESCAPE '\\'");values.push('%'+filters.language.toLowerCase().slice(0,80).replace(/[\\%_]/g,'\\$&')+'%');}
 if(Number.isFinite(filters.experience)&&filters.experience!>=0){clauses.push('p.experience_years>=?');values.push(filters.experience);}
 if(Number.isFinite(filters.salaryMax)&&filters.salaryMax!>=0){clauses.push('p.salary_min<=?');values.push(filters.salaryMax);}
 return {where:clauses.join(' AND '),values};
}
export async function listTalent(db:Database,filters:TalentFilters,recruiterId?:string){
 const product=!!await db.prepare("SELECT name FROM feature_flags WHERE name='PRODUCT_TALENT_SEARCH' AND enabled=1").bind().first();const privileged=!product&&recruiterId?await hasRecruiterAccess(db,recruiterId):false;
 const {where,values}=talentWhere(filters,privileged),page=Math.min(10000,Math.max(1,Math.floor(filters.page||1)));
 const total=await db.prepare(`SELECT COUNT(*) n FROM profiles p WHERE ${where}`).bind(...values).first<number>('n')??0;
 const rows=await db.prepare(`SELECT p.user_id,p.display_name,p.headline,p.target_role,p.location,p.salary_min,p.salary_max,p.experience_years,CASE WHEN p.product_profile_completed=1 THEN (SELECT GROUP_CONCAT(l.name||' '||cl.level,', ') FROM candidate_languages cl JOIN reference_languages l ON l.code=cl.language_code WHERE cl.user_id=p.user_id) ELSE p.languages END languages,p.bio,p.website,CASE WHEN p.product_profile_completed=1 THEN (SELECT GROUP_CONCAT(s.name,', ') FROM candidate_skills cs JOIN skills s ON s.id=cs.skill_id WHERE cs.user_id=p.user_id) ELSE (SELECT GROUP_CONCAT(skill,',') FROM profile_skills WHERE user_id=p.user_id) END skills FROM profiles p WHERE ${where} ORDER BY p.user_id LIMIT 24 OFFSET ?`).bind(...values,(page-1)*24).all<Talent>();
 return {rows:rows.results.map(p=>({...p,display_name:publicCandidateText(p.display_name),headline:publicCandidateText(p.headline),target_role:publicCandidateText(p.target_role),bio:publicCandidateText(p.bio),website:publicCandidateText(p.website)})),total,page,privileged};
}
export function csvCell(value:unknown){const text=String(value??'');return '"'+(/^[\s]*[=+@-]|^[\t\r\n]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';}
export async function exportTalent(db:Database,recruiterId:string,filters:TalentFilters,after=''){
 if(await db.prepare("SELECT name FROM feature_flags WHERE name='PRODUCT_TALENT_SEARCH' AND enabled=1").bind().first())throw new Error('Use Talent Search and in-platform invitations. Bulk candidate exports are unavailable.');
 if(!await hasRecruiterAccess(db,recruiterId))throw new Error('Active verified recruiter access required');
 const {where,values}=talentWhere(filters,true,true);
 const rows=await db.prepare(`SELECT p.user_id,p.display_name,p.headline,p.location,p.experience_years,p.salary_min,p.languages,p.website,CASE WHEN p.product_profile_completed=1 THEN (SELECT GROUP_CONCAT(s.name,', ') FROM candidate_skills cs JOIN skills s ON s.id=cs.skill_id WHERE cs.user_id=p.user_id) ELSE (SELECT GROUP_CONCAT(skill,',') FROM profile_skills WHERE user_id=p.user_id) END skills FROM profiles p JOIN users u ON u.id=p.user_id WHERE ${where} AND p.user_id>? ORDER BY p.user_id LIMIT 100`).bind(...values,after).all<Record<string,unknown>>();
 if(rows.results.length)await db.batch(rows.results.map(p=>db.prepare('INSERT INTO candidate_access_log(id,recruiter_id,candidate_id,kind,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),recruiterId,p.user_id,'export',new Date().toISOString())));
 const columns=['user_id','display_name','headline','location','experience_years','salary_min','languages','skills','website'];
 return {csv:[columns.join(','),...rows.results.map(row=>columns.map(c=>csvCell(row[c])).join(','))].join('\r\n'),after:rows.results.length===100?String(rows.results.at(-1)!.user_id):null,count:rows.results.length};
}
export async function candidateContact(db:Database,recruiterId:string,candidateId:string){
 if(await db.prepare("SELECT name FROM feature_flags WHERE name='PRODUCT_TALENT_SEARCH' AND enabled=1").bind().first())return null;
 if(!await hasRecruiterAccess(db,recruiterId))return null;
 return db.prepare(`SELECT u.email,p.cv_r2_key FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=? AND p.talent_pool_opt_in=1`).bind(candidateId).first<{email:string;cv_r2_key:string|null}>();
}
