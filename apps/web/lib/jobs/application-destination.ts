import type {JobsDatabase} from './queries';
export async function applicationDestination(db:JobsDatabase,tenantId:string,jobId:string) {
 const row=await db.prepare(`SELECT j.apply_url,l.apply_mode,l.expires_at,l.closed_at FROM jobs j
   LEFT JOIN employer_listings l ON l.job_id=j.id WHERE j.id=? AND j.tenant_id=? AND j.listed=1`)
   .bind(jobId,tenantId).first<{apply_url:string;apply_mode:string|null;expires_at:string|null;closed_at:string|null}>();
 if(!row)return null;
 if(row.apply_mode==='internal'&&!row.closed_at&&row.expires_at&&row.expires_at>new Date().toISOString())return {mode:'internal' as const};
 if(row.apply_mode&&((row.expires_at??'')<=new Date().toISOString()||row.closed_at))return null;
 try {const u=new URL(row.apply_url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;return {mode:'external' as const,url:u.href};}catch{return null;}
}
