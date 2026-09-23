import {companyAccountActive} from './company-claims';
import {earlyAccessState,eligibleForJob,matchScore} from '@gaming/shared';
import type {Database,PlatformEnv,Statement} from '../platform';
import {candidateDetails,candidateMatchProfile,candidatePremium,publicCandidate} from './candidates';
import type {CanonicalPosting} from './posting-input';
import {cvUploadRejection} from '../profile/cv';

type ApplicationJob={id:string;tenant_id:string;title:string;slug:string;company_id:string;commercial_origin:string;listed:number;early_access_until:string|null;confidential:number;apply_url:string;apply_mode:string;contact_email:string|null;owner_id:string;expires_at:string|null;closed_at:string|null;input_json:string|null};
export async function applicationState(db:Database,tenantId:string,jobId:string,userId:string|null,now=new Date()){
 const job=await db.prepare(`SELECT j.id,j.tenant_id,j.title,j.slug,j.company_id,j.commercial_origin,j.listed,j.early_access_until,j.confidential,j.apply_url,l.apply_mode,l.contact_email,l.user_id AS owner_id,COALESCE(l.expires_at,j.expires_at) AS expires_at,l.closed_at,n.input_json
  FROM jobs j LEFT JOIN employer_listings l ON l.job_id=j.id LEFT JOIN native_listing_details n ON n.job_id=j.id WHERE j.id=? AND j.tenant_id=?`).bind(jobId,tenantId).first<ApplicationJob>();
 if(!job)return null;
 const native=job.commercial_origin!=='aggregated';
 const [premium,invite,application,details,user]=userId?await Promise.all([candidatePremium(db,userId,now),db.prepare("SELECT id FROM product_invitations WHERE job_id=? AND candidate_id=? AND status IN ('sent','accepted')").bind(jobId,userId).first(),db.prepare('SELECT a.id,a.status FROM authenticated_applications k JOIN job_applications a ON a.id=k.application_id WHERE k.job_id=? AND k.user_id=?').bind(jobId,userId).first<{id:string;status:string}>(),candidateDetails(db,userId),db.prepare('SELECT email_verified FROM users WHERE id=? AND tenant_id=?').bind(userId,tenantId).first<{email_verified:number}>()]):[false,null,null,null,null];
 const listing=job.input_json?JSON.parse(job.input_json) as CanonicalPosting:null;
 const early=earlyAccessState({until:native?job.early_access_until:null,premium,invited:!!invite,now});
 const closed=!job.listed||!!job.closed_at||!!job.expires_at&&Date.parse(job.expires_at)<=now.getTime();
 return {job,native,premium,invited:!!invite,application,details,listing,locked:early.locked,remainingMs:early.remainingMs,closed,verified:!!user?.email_verified,eligible:details?eligibleForJob(listing?.eligibility??null,candidateMatchProfile(details)):true};
}
export async function requireApplicationAccess(db:Database,tenantId:string,jobId:string,userId:string|null,now=new Date()){
 const state=await applicationState(db,tenantId,jobId,userId,now);if(!state||state.closed)throw Error('This job is closed.');
 if(!state.native)throw Error('Apply directly on the external company website.');
 if(state.job.confidential&&userId&&await companyAccountActive(db,tenantId,userId))throw Error('Only candidate accounts can apply to confidential jobs.');
 if(state.job.confidential&&!userId)throw Error('Sign in to view this confidential job.');
 if(state.locked)throw Error('Early Access is open to Premium or invited candidates.');
 if(userId&&!state.verified)throw Error('Verify your email before applying.');
 return state;
}
export async function recordNativeApplication(env:Pick<PlatformEnv,'DB'|'FILES'>,input:{tenantId:string;jobId:string;user:{id:string;email:string;name?:string}|null;mode:'email'|'redirect';form?:FormData},now=new Date()){
 const state=await requireApplicationAccess(env.DB,input.tenantId,input.jobId,input.user?.id??null,now),{job}=state,at=now.toISOString();
 if((input.mode==='email')!==(job.apply_mode==='internal'))throw Error('Application method changed. Refresh the job.');
 if(!input.user){if(input.mode!=='redirect')throw Error('Sign in before submitting your application.');await env.DB.prepare("INSERT INTO job_events VALUES(?,?,'apply_click',NULL,NULL,?)").bind(crypto.randomUUID(),job.id,at).run();return {url:safeApplicationUrl(job.apply_url),duplicate:false};}
 if(state.application?.status==='withdrawn')throw Error('You withdrew this application.');
 if(state.application)return {url:input.mode==='redirect'?safeApplicationUrl(job.apply_url):null,duplicate:true};
 const details=state.details!,name=String(input.form?.get('name')||details.profile?.display_name||input.user.name||'').trim(),note=String(input.form?.get('note')||'').trim();
 if(name.length<2||name.length>120||note.length>4000)throw Error('Check your name and message.');
 const id=crypto.randomUUID(),cvKey=`applications/${input.user.id}/${id}.pdf`;let uploaded=false,key:string|null=null;
 if(input.mode==='email'){
  const file=input.form?.get('cv');
  let body:ArrayBuffer|null=null;
  if(file instanceof File&&file.size){if(cvUploadRejection(file))throw Error('Upload a PDF CV up to 5 MB.');body=await file.arrayBuffer();}
  else if(details.profile?.cv_r2_key){const stored=await env.FILES.get(details.profile.cv_r2_key);if(stored)body=await new Response(stored.body).arrayBuffer();}
  if(!body||body.byteLength>5*1024*1024||new TextDecoder().decode(body.slice(0,5))!=='%PDF-')throw Error('Add a valid PDF CV to your profile or this application.');
  await env.FILES.put(cvKey,body,{httpMetadata:{contentType:'application/pdf'}});key=cvKey;uploaded=true;
 }
 const score=state.listing?matchScore(state.listing,candidateMatchProfile(details)):null,status=input.mode==='redirect'?'redirected':'applied';
 const guard=`EXISTS(SELECT 1 FROM jobs j JOIN employer_listings l ON l.job_id=j.id WHERE j.id=? AND j.listed=1 AND l.closed_at IS NULL AND l.expires_at>? AND (j.early_access_until IS NULL OR j.early_access_until<=? OR EXISTS(SELECT 1 FROM candidate_subscriptions s WHERE s.user_id=? AND s.status IN ('active','trialing') AND s.renews_at>?) OR EXISTS(SELECT 1 FROM product_invitations i WHERE i.job_id=j.id AND i.candidate_id=? AND i.status IN ('sent','accepted'))))`;
 const gateValues=[job.id,at,at,input.user.id,at,input.user.id];
 const exists='EXISTS(SELECT 1 FROM job_applications WHERE id=?)';
 const statements:Statement[]=[
  env.DB.prepare(`INSERT OR IGNORE INTO authenticated_applications(job_id,user_id) SELECT ?,? WHERE ${guard}`).bind(job.id,input.user.id,...gateValues),
  env.DB.prepare(`INSERT OR IGNORE INTO job_applications(id,tenant_id,job_id,user_id,name,email,note,cv_r2_key,status,profile_snapshot_json,match_score,score_breakdown_json,invited,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM authenticated_applications WHERE job_id=? AND user_id=? AND application_id IS NULL) AND ${guard}`)
    .bind(id,input.tenantId,job.id,input.user.id,name,input.user.email.toLowerCase(),note,key,status,JSON.stringify(publicCandidate(details)),score?.score??null,score?JSON.stringify(score.breakdown):null,state.invited?1:0,at,at,job.id,input.user.id,...gateValues),
  env.DB.prepare(`UPDATE authenticated_applications SET application_id=? WHERE job_id=? AND user_id=? AND application_id IS NULL AND ${exists}`).bind(id,job.id,input.user.id,id),
  env.DB.prepare(`INSERT INTO application_stage_history SELECT ?,?,?,?,? WHERE ${exists}`).bind(crypto.randomUUID(),id,status,input.user.id,at,id),
  env.DB.prepare(`INSERT INTO job_events SELECT ?,?,'application',NULL,NULL,? WHERE ${exists}`).bind(crypto.randomUUID(),job.id,at,id),
  env.DB.prepare(`INSERT INTO job_events SELECT ?,?,'apply_click',NULL,NULL,? WHERE ${exists}`).bind(crypto.randomUUID(),job.id,at,id),
  env.DB.prepare(`UPDATE product_invitations SET status='accepted' WHERE job_id=? AND candidate_id=? AND ${exists}`).bind(job.id,input.user.id,id),
  env.DB.prepare(`INSERT OR IGNORE INTO notification_outbox(id,user_id,application_id,kind,subject,body,destination_path,created_at) SELECT ?,?,?,'application_confirmation',?,?,?,? WHERE ${exists}`)
    .bind('candidate:'+id,input.user.id,id,'Application recorded: '+job.title,input.mode==='redirect'?'Your profile has been recorded. Complete the application on the employer website.':'Your application and CV have been shared with the employer.','/account/applications',at,id),
  env.DB.prepare(`INSERT OR IGNORE INTO notification_outbox(id,user_id,application_id,kind,subject,body,destination_path,created_at,recipient_email) SELECT ?,?,?,'application_received',?,?,?, ?,? WHERE ${exists}`)
    .bind('employer:'+id,job.owner_id,id,'New application: '+job.title,`${name} applied. Sign in to review the submitted profile, message and private CV.`, '/employer/applications',at,job.contact_email||null,id),
 ];
 try{await env.DB.batch(statements);const saved=await env.DB.prepare('SELECT id FROM job_applications WHERE id=?').bind(id).first();if(!saved&&uploaded){await env.FILES.delete?.(cvKey);uploaded=false;}if(!saved&&!await env.DB.prepare('SELECT application_id FROM authenticated_applications WHERE job_id=? AND user_id=? AND application_id IS NOT NULL').bind(job.id,input.user.id).first())throw Error('This job is no longer accepting applications.');}
 catch(error){if(uploaded)await env.FILES.delete?.(cvKey);throw error;}
 return {url:input.mode==='redirect'?safeApplicationUrl(job.apply_url):null,duplicate:false};
}
function safeApplicationUrl(value:string){const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('Invalid application destination.');return url.href;}
export async function subscribeEarlyReminder(db:Database,tenantId:string,jobId:string,userId:string){const state=await applicationState(db,tenantId,jobId,userId);if(!state?.native||!state.locked||state.closed||!state.verified)throw Error('A verified account and an active Early Access job are required.');await db.prepare('INSERT OR IGNORE INTO early_access_reminders(job_id,user_id,created_at) VALUES(?,?,?)').bind(jobId,userId,new Date().toISOString()).run();}
