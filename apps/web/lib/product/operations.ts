import type {Database} from '../platform';
export function prioritySupportDue(now=new Date()) {const due=new Date(now);let hours=0;while(hours<24){due.setUTCHours(due.getUTCHours()+1);if(due.getUTCDay()!==0&&due.getUTCDay()!==6)hours++;}return due.toISOString();}
export async function talentReadAllowance(db:Database,userId:string,kind:'search'|'profile',candidateId:string|null=null,now=new Date()){
 const at=now.toISOString();for(const [window,limit] of [[at.slice(0,16),kind==='search'?30:60],[at.slice(0,10),kind==='search'?600:1500]] as const){const result=await db.prepare('INSERT INTO product_rate_limits(user_id,kind,window,hits) VALUES(?,?,?,1) ON CONFLICT(user_id,kind,window) DO UPDATE SET hits=hits+1 WHERE hits<?').bind(userId,kind,window,limit).run();if(!result.meta?.changes)return false;}
 await db.prepare('INSERT INTO candidate_access_log(id,recruiter_id,candidate_id,kind,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),userId,candidateId,'talent_'+kind,at).run();return true;
}
