import type {Database} from './platform';
import {hasRecruiterAccess} from './billing/marketplace';
export type Talent={user_id:string;display_name:string|null;headline:string|null;target_role:string|null;location:string|null;salary_min:number|null;salary_max:number|null;experience_years:number|null;languages:string|null;skills:string|null;bio:string|null;website:string|null};
export async function listTalent(db:Database,filters:{skill?:string;location?:string;query?:string;page?:number},recruiterId?:string){
 const privileged=recruiterId?await hasRecruiterAccess(db,recruiterId):false;
 const clauses=[privileged?'(p.public_profile=1 OR p.talent_pool_opt_in=1)':'p.public_profile=1'],values:unknown[]=[];
 if(filters.skill){clauses.push('EXISTS(SELECT 1 FROM profile_skills s WHERE s.user_id=p.user_id AND s.skill=?)');values.push(filters.skill);}
 if(filters.location){clauses.push('LOWER(p.location)=?');values.push(filters.location.replaceAll('-',' ').toLowerCase());}
 if(filters.query){clauses.push("(p.target_role LIKE ? ESCAPE '\\' OR p.headline LIKE ? ESCAPE '\\')");const like='%'+filters.query.slice(0,100).replace(/[\\%_]/g,'\\$&')+'%';values.push(like,like);}
 const where=clauses.join(' AND '),page=Math.max(1,Math.floor(filters.page||1));
 const total=await db.prepare(`SELECT COUNT(*) n FROM profiles p WHERE ${where}`).bind(...values).first<number>('n')??0;
 const rows=await db.prepare(`SELECT p.user_id,p.display_name,p.headline,p.target_role,p.location,p.salary_min,p.salary_max,p.experience_years,p.languages,p.bio,p.website,(SELECT GROUP_CONCAT(skill,',') FROM profile_skills WHERE user_id=p.user_id) skills FROM profiles p WHERE ${where} ORDER BY p.user_id LIMIT 24 OFFSET ?`).bind(...values,(page-1)*24).all<Talent>();
 return {rows:rows.results,total,page,privileged};
}
export async function candidateContact(db:Database,recruiterId:string,candidateId:string){
 if(!await hasRecruiterAccess(db,recruiterId))return null;
 return db.prepare(`SELECT u.email,p.cv_r2_key FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=? AND p.talent_pool_opt_in=1`).bind(candidateId).first<{email:string;cv_r2_key:string|null}>();
}
