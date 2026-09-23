import {pricing,type CompanyPlanTier,type JobQuoteContext} from '@gaming/shared';
import type {Database,Statement} from '../platform';
import {canManageCompany} from './company-claims';
import {COMPANY_MEMBER_ACCESS_SQL} from './job-access';

export type CompanyPlan={company_id:string;owner_user_id:string|null;tier:CompanyPlanTier;provider_ref:string;customer_id:string|null;status:string;period_start:string;renews_at:string;cancel_at_period_end:number};
export async function companyPlan(db:Database,companyId:string,now=new Date()){return db.prepare("SELECT * FROM company_plans WHERE company_id=? AND status IN ('active','trialing') AND renews_at>?").bind(companyId,now.toISOString()).first<CompanyPlan>();}
export async function companyMembership(db:Database,userId:string,companyId:string){return db.prepare(`SELECT role FROM company_members j WHERE j.user_id=? AND j.company_id=? AND ${COMPANY_MEMBER_ACCESS_SQL}`).bind(userId,companyId,userId).first<{role:'owner'|'member'}>();}
export async function canUseCompanyJobs(db:Database,userId:string,companyId:string){const membership=await companyMembership(db,userId,companyId);return !!membership;}
export async function companyQuoteContext(db:Database,userId:string,companyId:string,earlyFree:boolean,now=new Date()):Promise<{context:JobQuoteContext;periodId:string|null}>{
 const at=now.toISOString(),plan=await companyPlan(db,companyId,now);
 const permitted=plan&&(plan.owner_user_id===userId||await companyMembership(db,userId,companyId));
 const active=await db.prepare(`SELECT (SELECT COUNT(*) FROM jobs WHERE company_id=? AND listed=1 AND commercial_origin IN ('native','native_ats') AND expires_at>?)+(SELECT COUNT(*) FROM plan_credit_reservations WHERE company_id=? AND status='held') n`).bind(companyId,at,companyId).first<number>('n')??0;
 const firstPost=!await db.prepare("SELECT id FROM jobs WHERE company_id=? AND commercial_origin IN ('native','native_ats') UNION ALL SELECT id FROM employer_orders WHERE status='pending' AND offer_version=2 AND json_extract(payload_json,'$.companyId')=? LIMIT 1").bind(companyId,companyId).first();
 if(!permitted)return {context:{plan:null,availableCredits:0,postsPublishedInPeriod:0,activePosts:active,firstPost,earlyAccessFreeFirstPost:earlyFree},periodId:null};
 const period=await db.prepare('SELECT id,granted FROM company_plan_periods WHERE company_id=? AND provider_ref=? AND period_start=? AND revoked=0 AND expires_at>?').bind(companyId,plan.provider_ref,plan.period_start,at).first<{id:string;granted:number}>();
 if(!period)throw Error('The plan payment is still being confirmed. Refresh billing before publishing.');
 const balance=await db.prepare(`SELECT (SELECT COUNT(*) FROM credit_ledger WHERE period_id=? AND reason='publish') AS used,
 (SELECT COUNT(*) FROM plan_credit_reservations WHERE period_id=? AND status='held') AS held,
 (SELECT COUNT(*) FROM plan_credit_reservations WHERE period_id=? AND status IN ('held','used') AND kind='credit') AS credits`).bind(period.id,period.id,period.id).first<{used:number;held:number;credits:number}>();
 return {context:{plan:plan.tier,availableCredits:Math.max(0,period.granted-(balance?.credits??0)),postsPublishedInPeriod:(balance?.used??0)+(balance?.held??0),activePosts:active,firstPost,earlyAccessFreeFirstPost:earlyFree},periodId:period.id};
}
export async function reserveCompanyPost(db:Database,orderId:string,companyId:string,periodId:string,context:JobQuoteContext,now=new Date()){
 const platinum=context.plan==='platinum',kind=platinum?(context.postsPublishedInPeriod<pricing.platinumFairUse.perYear?'fair_use':'extra'):context.availableCredits>0?'credit':'extra',at=now.toISOString();
 const creditGuard=kind==='credit'?`AND p.granted>(SELECT COUNT(*) FROM plan_credit_reservations r WHERE r.period_id=p.id AND r.kind='credit' AND r.status IN ('held','used'))`:'';
 const fairGuard=kind==='fair_use'?`AND (SELECT COUNT(*) FROM plan_credit_reservations r WHERE r.period_id=p.id AND r.status IN ('held','used'))<${pricing.platinumFairUse.perYear}`:'';
 const activeGuard=platinum?`AND ((SELECT COUNT(*) FROM jobs j WHERE j.company_id=p.company_id AND j.listed=1 AND j.commercial_origin IN ('native','native_ats') AND j.expires_at>?)+(SELECT COUNT(*) FROM plan_credit_reservations r WHERE r.company_id=p.company_id AND r.status='held'))<${pricing.platinumFairUse.maxActive}`:'';
 await db.prepare(`INSERT OR IGNORE INTO plan_credit_reservations(order_id,company_id,period_id,kind,created_at) SELECT ?,?,?,?,? FROM company_plan_periods p WHERE p.id=? AND p.revoked=0 AND p.expires_at>? ${creditGuard} ${fairGuard} ${activeGuard}`)
 .bind(orderId,companyId,periodId,kind,at,periodId,at,...(platinum?[at]:[])).run();
 if(!await db.prepare("SELECT order_id FROM plan_credit_reservations WHERE order_id=? AND status='held'").bind(orderId).first())throw Error('Your company allowance changed. Refresh the form before publishing.');
}
export function consumeCompanyPostStatements(db:Database,orderId:string,jobId:string,tier:CompanyPlanTier|null,now:Date):Statement[]{if(!tier)return [];const at=now.toISOString();return [
 db.prepare(`INSERT OR IGNORE INTO credit_ledger(id,company_id,period_id,job_id,order_id,delta,reason,created_at) SELECT ?,company_id,period_id,?,?,CASE WHEN kind='credit' THEN -1 ELSE 0 END,'publish',? FROM plan_credit_reservations WHERE order_id=? AND status='held' AND EXISTS(SELECT 1 FROM jobs WHERE id=?)`).bind('publish:'+orderId,jobId,orderId,at,orderId,jobId),
 db.prepare(`UPDATE jobs SET plan_tier=?,plan_credit_id=(SELECT period_id FROM plan_credit_reservations WHERE order_id=?) WHERE id=?`).bind(tier,orderId,jobId),
 db.prepare("UPDATE plan_credit_reservations SET status='used' WHERE order_id=? AND EXISTS(SELECT 1 FROM jobs WHERE id=?)").bind(orderId,jobId),
 db.prepare(`INSERT OR IGNORE INTO notification_outbox(id,user_id,kind,subject,body,destination_path,created_at) SELECT 'credits:'||p.id||':'||CAST((p.granted-(SELECT COUNT(*) FROM credit_ledger l WHERE l.period_id=p.id AND l.delta=-1)) AS TEXT),c.owner_user_id,'low_credits','Your job credits are running low','Review your remaining credits and extra-post price before publishing another job.','/employer/billing',? FROM company_plan_periods p JOIN company_plans c ON c.company_id=p.company_id WHERE p.id=(SELECT period_id FROM plan_credit_reservations WHERE order_id=?) AND p.granted>0 AND p.granted-(SELECT COUNT(*) FROM credit_ledger l WHERE l.period_id=p.id AND l.delta=-1)<=1`).bind(at,orderId),
 ];}
export async function bumpJob(db:Database,userId:string,jobId:string,now=new Date()){
 const job=await db.prepare('SELECT j.company_id,l.user_id FROM jobs j JOIN employer_listings l ON l.job_id=j.id WHERE j.id=? AND j.listed=1 AND l.closed_at IS NULL AND l.expires_at>?').bind(jobId,now.toISOString()).first<{company_id:string;user_id:string}>();
 if(!job||(job.user_id!==userId&&!await companyMembership(db,userId,job.company_id))||!await companyPlan(db,job.company_id,now))throw Error('An active company plan and job access are required.');
 const result=await db.prepare("UPDATE jobs SET bumped_at=?,bumps_used=1 WHERE id=? AND bumps_used=0 AND commercial_origin IN ('native','native_ats') AND plan_tier IS NOT NULL").bind(now.toISOString(),jobId).run();if(!result.meta?.changes)throw Error('This post has no bump available.');
}
export async function inviteTeamMember(db:Database,tenantId:string,ownerId:string,companyId:string,email:string,now=new Date()){
 if(!await canManageCompany(db,tenantId,ownerId,companyId))throw Error('Verified company ownership is required.');
 const plan=await companyPlan(db,companyId,now);if(!plan)throw Error('An active annual plan is required.');
 email=email.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('Enter a valid teammate email.');
 const limit=pricing.plans[plan.tier].seats??1000000,id=crypto.randomUUID(),at=now.toISOString();
 await db.prepare("UPDATE company_team_invitations SET status='expired' WHERE company_id=? AND status='pending' AND expires_at<=?").bind(companyId,at).run();
 await db.prepare(`INSERT OR IGNORE INTO company_team_invitations(id,company_id,email,invited_by,created_at,expires_at) SELECT ?,?,?,?,?,?
 WHERE (SELECT COUNT(*) FROM company_members WHERE company_id=?)+(SELECT COUNT(*) FROM company_team_invitations WHERE company_id=? AND status='pending' AND expires_at>?)<?
 AND NOT EXISTS(SELECT 1 FROM company_members m JOIN users u ON u.id=m.user_id WHERE m.company_id=? AND lower(u.email)=?)`)
 .bind(id,companyId,email,ownerId,at,new Date(now.getTime()+7*86400000).toISOString(),companyId,companyId,at,limit,companyId,email).run();
 if(!await db.prepare('SELECT id FROM company_team_invitations WHERE id=?').bind(id).first())throw Error('Seat limit reached, or this email is already a member/invitee.');
 await db.prepare(`INSERT OR IGNORE INTO notification_outbox(id,user_id,kind,subject,body,destination_path,created_at,recipient_email) VALUES(?,?,'team_invitation','Join your company on Nodework','Sign in with this email address to accept the invitation.',?,?,?)`).bind('team:'+id,ownerId,'/employer/team?invitation='+id,at,email).run();return id;
}
export async function acceptTeamInvitation(db:Database,user:{id:string;email:string;emailVerified:boolean},id:string,now=new Date()){
 if(!user.emailVerified)throw Error('Verify your email first.');const invite=await db.prepare("SELECT company_id FROM company_team_invitations WHERE id=? AND email=? AND status='pending' AND expires_at>?").bind(id,user.email.toLowerCase(),now.toISOString()).first<{company_id:string}>();if(!invite)throw Error('Invitation unavailable.');
 const plan=await companyPlan(db,invite.company_id,now);if(!plan)throw Error('Company plan is not active.');const limit=pricing.plans[plan.tier].seats??1000000;
 await db.batch([db.prepare(`INSERT OR IGNORE INTO company_members(company_id,user_id,role,created_at) SELECT ?,?,'member',? WHERE (SELECT COUNT(*) FROM company_members WHERE company_id=?)<? AND EXISTS(SELECT 1 FROM company_claims WHERE company_id=? AND status='approved')`).bind(invite.company_id,user.id,now.toISOString(),invite.company_id,limit,invite.company_id),db.prepare("UPDATE company_team_invitations SET status='accepted' WHERE id=? AND EXISTS(SELECT 1 FROM company_members WHERE company_id=? AND user_id=?)").bind(id,invite.company_id,user.id)]);
 if(!await companyMembership(db,user.id,invite.company_id))throw Error('Company access could not be granted.');
}
