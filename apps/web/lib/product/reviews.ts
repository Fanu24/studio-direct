import type {Database,PlatformEnv} from '../platform';
import {candidatePremium} from './candidates';
import {companyAccountActive,companyIsClaimed,canManageCompany} from './company-claims';
import {companyMembership} from './company-plans';
import {putPrivateEvidence} from './verification';
export async function reviewReadAccess(db:Database,tenantId:string,userId:string|null){return !!userId&&(await candidatePremium(db,userId)||await companyAccountActive(db,tenantId,userId));}
export async function companyReviewSummary(db:Database,companyId:string){const row=await db.prepare("SELECT COUNT(*) count,AVG(overall) overall,AVG(paid_on_time) paidOnTime,AVG(transparent_process) transparentProcess,AVG(would_work_again) wouldWorkAgain FROM company_reviews WHERE company_id=? AND status='published'").bind(companyId).first<{count:number;overall:number|null;paidOnTime:number|null;transparentProcess:number|null;wouldWorkAgain:number|null}>();const distribution=await db.prepare("SELECT overall,COUNT(*) count FROM company_reviews WHERE company_id=? AND status='published' GROUP BY overall").bind(companyId).all<{overall:number;count:number}>();return {...row,distribution:distribution.results};}
export async function readableCompanyReviews(db:Database,companyId:string,readText:boolean){
 // Restricted bodies and identity are never selected for an unauthorized response.
 return (await db.prepare(`SELECT r.id,r.overall,r.relationship,r.created_at,r.is_anonymous,${readText?"r.body,CASE WHEN r.is_anonymous=0 THEN COALESCE(p.display_name,'Candidate') ELSE 'Anonymous candidate' END AS author,s.body AS response":"NULL AS body,NULL AS author,NULL AS response"}
 FROM company_reviews r LEFT JOIN profiles p ON p.user_id=r.user_id LEFT JOIN review_responses s ON s.review_id=r.id WHERE r.company_id=? AND r.status='published' ORDER BY r.created_at DESC LIMIT 100`).bind(companyId).all<{id:string;overall:number;relationship:string;created_at:string;is_anonymous:number;body:string|null;author:string|null;response:string|null}>()).results;
}
export async function submitCompanyReview(env:Pick<PlatformEnv,'DB'|'FILES'>,input:{tenantId:string;userId:string;form:FormData},now=new Date()){
 const db=env.DB,f=input.form,companyId=String(f.get('companyId')??''),id=String(f.get('reviewId')||crypto.randomUUID()),user=await db.prepare('SELECT email,email_verified,created_at FROM users WHERE id=? AND tenant_id=?').bind(input.userId,input.tenantId).first<{email:string;email_verified:number;created_at:string}>();
 if(!user?.email_verified||Date.parse(user.created_at)>now.getTime()-7*86400000||!await candidatePremium(db,input.userId,now)||await companyAccountActive(db,input.tenantId,input.userId))throw Error('Only Premium candidates with a verified email and an account at least seven days old can review. Company accounts cannot write reviews.');
 if(!await companyIsClaimed(db,input.tenantId,companyId))throw Error('Only claimed companies can be reviewed.');
 const domain=await db.prepare('SELECT domain FROM companies WHERE id=? AND tenant_id=?').bind(companyId,input.tenantId).first<string>('domain');if(domain&&user.email.split('@')[1]?.toLowerCase()===domain.replace(/^www\./,'').toLowerCase())throw Error('Use an independent personal candidate account rather than an email on the company domain.');
 const body=String(f.get('body')??'').trim(),relationship=String(f.get('relationship'));if(body.length<50||body.length>1500||!['contract','employee','bounty_grant'].includes(relationship))throw Error('Describe actual work with this company in 50–1500 characters. Interviews alone are not eligible.');
 const scores=['overall','paid_on_time','transparent_process','would_work_again'].map(key=>Number(f.get(key)));if(scores.some(s=>!Number.isInteger(s)||s<1||s>5))throw Error('Choose each rating from 1 to 5.');
 const existing=await db.prepare('SELECT user_id,company_id,created_at FROM company_reviews WHERE id=?').bind(id).first<{user_id:string;company_id:string;created_at:string}>();
 if(existing){if(existing.user_id!==input.userId||existing.company_id!==companyId||Date.parse(existing.created_at)<now.getTime()-30*86400000)throw Error('Reviews can be edited by their author for 30 days.');await db.prepare("UPDATE company_reviews SET overall=?,paid_on_time=?,transparent_process=?,would_work_again=?,relationship=?,body=?,is_anonymous=?,status='pending',updated_at=? WHERE id=? AND user_id=?").bind(...scores,relationship,body,f.get('anonymous')==='1'?1:0,now.toISOString(),id,input.userId).run();return id;}
 const cutoff=new Date(now);cutoff.setUTCFullYear(cutoff.getUTCFullYear()-1);
 if(await db.prepare('SELECT id FROM company_reviews WHERE company_id=? AND user_id=? AND created_at>?').bind(companyId,input.userId,cutoff.toISOString()).first())throw Error('You can review a company once every 12 months.');
 const evidence=f.get('evidence');if(!(evidence instanceof File))throw Error('Attach evidence that you worked for this company.');const key=await putPrivateEvidence(env,'work-evidence/'+input.userId+'/'+id,evidence),at=now.toISOString();
 try{await db.batch([
  db.prepare(`INSERT INTO company_reviews(id,tenant_id,company_id,user_id,overall,paid_on_time,transparent_process,would_work_again,relationship,body,is_anonymous,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM company_reviews WHERE company_id=? AND user_id=? AND created_at>?)`).bind(id,input.tenantId,companyId,input.userId,...scores,relationship,body,f.get('anonymous')==='1'?1:0,at,at,companyId,input.userId,cutoff.toISOString()),
  db.prepare('INSERT INTO review_work_evidence(review_id,user_id,r2_key) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM company_reviews WHERE id=?)').bind(id,input.userId,key,id),
 ]);if(!await db.prepare('SELECT id FROM company_reviews WHERE id=?').bind(id).first())throw Error('A review for this company already exists.');}catch(error){await env.FILES.delete?.(key);throw error;}return id;
}
export async function moderateCompanyReview(db:Database,input:{id:string;tenantId:string;adminId:string;action:'publish'|'reject'|'remove';reason:string;employmentConfirmed:boolean},now=new Date()){
 if(input.reason.trim().length<10||input.reason.length>2000)throw Error('Record a moderation reason.');
 const review=await db.prepare('SELECT r.user_id,r.company_id,e.r2_key FROM company_reviews r JOIN review_work_evidence e ON e.review_id=r.id WHERE r.id=? AND r.tenant_id=?').bind(input.id,input.tenantId).first<{user_id:string|null;company_id:string;r2_key:string}>();if(!review)throw Error('Review/evidence not found.');
 if(input.action==='publish'&&(!input.employmentConfirmed||!review.r2_key||!await companyIsClaimed(db,input.tenantId,review.company_id)))throw Error('Verify the employment evidence and company claim before publishing.');
 const at=now.toISOString();await db.batch([
  db.prepare('UPDATE review_work_evidence SET status=?,reviewed_by=?,reviewed_at=?,reason=? WHERE review_id=?').bind(input.action==='publish'?'approved':'rejected',input.adminId,at,input.reason,input.id),
  db.prepare("UPDATE company_reviews SET status=?,published_at=CASE WHEN ?='publish' THEN ? ELSE published_at END,updated_at=? WHERE id=? AND (?<>'publish' OR EXISTS(SELECT 1 FROM review_work_evidence WHERE review_id=? AND status='approved'))").bind(input.action==='publish'?'published':input.action==='remove'?'removed':'rejected',input.action,at,at,input.id,input.action,input.id),
  db.prepare('INSERT INTO review_moderation_history VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),input.id,input.adminId,input.action,input.reason,at),
  db.prepare("UPDATE review_reports SET status='reviewed' WHERE review_id=?").bind(input.id),
  db.prepare("INSERT OR IGNORE INTO notification_outbox(id,user_id,kind,subject,body,destination_path,created_at) VALUES(?,?,'review_published','Your company review was reviewed',?,'/account/reviews',?)").bind('review:'+input.id+':'+at,review.user_id,input.action==='publish'?'Your employment evidence was accepted and the review is public.':'The moderation decision is available in your account.',at),
 ]);
}
export async function respondToReview(db:Database,tenantId:string,userId:string,reviewId:string,body:string,now=new Date()){
 body=body.trim();if(body.length<10||body.length>2000)throw Error('Write a response of 10–2000 characters.');const review=await db.prepare("SELECT company_id,user_id FROM company_reviews WHERE id=? AND tenant_id=? AND status='published'").bind(reviewId,tenantId).first<{company_id:string;user_id:string|null}>();if(!review||!await canManageCompany(db,tenantId,userId,review.company_id)&&!await companyMembership(db,userId,review.company_id))throw Error('Verified company access required.');const at=now.toISOString();await db.batch([
 db.prepare('INSERT INTO review_responses VALUES(?,?,?,?,?,?) ON CONFLICT(review_id) DO UPDATE SET body=excluded.body,user_id=excluded.user_id,updated_at=excluded.updated_at').bind(reviewId,review.company_id,userId,body,at,at),
 db.prepare("INSERT OR IGNORE INTO notification_outbox(id,user_id,kind,subject,body,destination_path,created_at) VALUES(?,?,'review_response','A company responded to your review','Read the company response in your reviews.','/account/reviews',?)").bind('response:'+reviewId,review.user_id,at),
 ]);
}
