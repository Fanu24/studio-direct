import type {Database} from '../platform';

export const JOBS_API_REQUESTS_PER_MINUTE=60;
export type ApiKeySummary={id:string;prefix:string;website:string;created_at:string;revoked_at:string|null;last_used_at:string|null};
async function tokenHash(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function listApiKeys(db:Database,userId:string){return (await db.prepare('SELECT id,prefix,website,created_at,revoked_at,last_used_at FROM jobs_api_keys WHERE user_id=? ORDER BY created_at DESC').bind(userId).all<ApiKeySummary>()).results;}
export async function createApiKey(db:Database,userId:string,website:string){
 const url=new URL(website);if(url.protocol!=='https:'||url.username||url.password||website.length>500)throw new Error('Enter the HTTPS website where you will use this API');
 const token='nw_'+Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''),id=crypto.randomUUID();
 const result=await db.prepare(`INSERT INTO jobs_api_keys(id,user_id,token_hash,prefix,website,created_at)
 SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM jobs_api_keys WHERE user_id=? AND revoked_at IS NULL)<5`).bind(id,userId,await tokenHash(token),token.slice(0,11),url.href,new Date().toISOString(),userId).run();
 if(!result.meta?.changes)throw new Error('Revoke an existing key before creating another (maximum 5 active keys)');
 return {id,token};
}
export async function revokeApiKey(db:Database,userId:string,id:string){await db.prepare('UPDATE jobs_api_keys SET revoked_at=COALESCE(revoked_at,?) WHERE id=? AND user_id=?').bind(new Date().toISOString(),id,userId).run();}
export async function authorizeApiKey(db:Database,token:string,now=Date.now()):Promise<{ok:true;remaining:number}|{ok:false;status:401|429;retryAfter?:number}>{
 if(!/^nw_[a-f0-9]{64}$/.test(token))return {ok:false,status:401};
 const hash=await tokenHash(token),window=Math.floor(now/60000),retryAfter=60-Math.floor(now/1000)%60;
 // A single UPDATE keeps concurrent requests from overshooting the allowance.
 const row=await db.prepare(`UPDATE jobs_api_keys SET window_start=?,request_count=CASE WHEN window_start=? THEN request_count+1 ELSE 1 END,last_used_at=?
 WHERE token_hash=? AND revoked_at IS NULL AND (window_start!=? OR request_count<?) RETURNING request_count`).bind(window,window,new Date(now).toISOString(),hash,window,JOBS_API_REQUESTS_PER_MINUTE).first<{request_count:number}>();
 if(row)return {ok:true,remaining:JOBS_API_REQUESTS_PER_MINUTE-row.request_count};
 const active=await db.prepare('SELECT id FROM jobs_api_keys WHERE token_hash=? AND revoked_at IS NULL').bind(hash).first();
 return active?{ok:false,status:429,retryAfter}:{ok:false,status:401};
}
