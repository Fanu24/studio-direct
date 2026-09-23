import type {Database,PlatformEnv} from '../platform';
import {cvUploadRejection} from '../profile/cv';
import {parseApplyInput} from './apply';
import {JOB_ACCESS_SQL} from '../product/job-access';
import {recordNativeApplication} from '../product/applications';
export const APPLICATION_STATUSES=['redirected','applied','reviewed','interview','rejected','hired'] as const;
export async function submitCandidateApplication(env:Pick<PlatformEnv,'DB'|'FILES'>,user:{id:string;email:string},tenantId:string,form:FormData){
 const native=await env.DB.prepare("SELECT id FROM jobs WHERE id=? AND tenant_id=? AND commercial_origin IN ('native','native_ats')").bind(String(form.get('jobId')||''),tenantId).first();
 if(native){await recordNativeApplication(env,{tenantId,jobId:String(form.get('jobId')),user,mode:'email',form});return;}
 if(await env.DB.prepare("SELECT name FROM feature_flags WHERE tenant_id=? AND name='PRODUCT_POSTING_V2' AND enabled=1").bind(tenantId).first())throw Error('Apply directly on the external company website.');
 const raw=parseApplyInput({tenantId,jobId:String(form.get('jobId')||''),name:String(form.get('name')||''),email:user.email,profileUrl:String(form.get('profileUrl')||''),note:String(form.get('note')||''),honeypot:String(form.get('company_website')||'')});
 if(raw.honeypot)return;
 if(raw.name.length<2)throw new Error('Enter your name');
 if(raw.profileUrl){const url=new URL(raw.profileUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid profile URL');}
 const existing=await env.DB.prepare('SELECT id,status FROM job_applications WHERE job_id=? AND email=?').bind(raw.jobId,user.email.toLowerCase()).first<{id:string;status:string}>();
 if(existing?.status==='withdrawn')throw new Error('You withdrew this application. It has not been submitted again.');
 if(existing)return;
 const job=await env.DB.prepare(`SELECT j.title,l.user_id FROM jobs j JOIN employer_listings l ON l.job_id=j.id WHERE j.id=? AND j.tenant_id=? AND j.listed=1 AND l.apply_mode='internal' AND l.closed_at IS NULL AND l.expires_at>?`).bind(raw.jobId,tenantId,new Date().toISOString()).first<{title:string;user_id:string}>();
 if(!job)throw new Error('This job is no longer accepting applications');
 const id=crypto.randomUUID(),now=new Date().toISOString();let key:string|null=null;
 const file=form.get('cv');
 if(file instanceof File&&file.size){
  const rejection=cvUploadRejection(file);if(rejection)throw new Error('Upload a PDF CV no larger than 5 MB');
  const body=await file.arrayBuffer();if(body.byteLength>5*1024*1024||new TextDecoder().decode(body.slice(0,5))!=='%PDF-')throw new Error('Upload a valid PDF CV');
  key=`applications/${user.id}/${id}.pdf`;await env.FILES.put(key,body,{httpMetadata:{contentType:'application/pdf'}});
 }
 try{
  await env.DB.batch([
   env.DB.prepare(`INSERT OR IGNORE INTO job_applications(id,tenant_id,job_id,user_id,name,email,profile_url,note,cv_r2_key,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM jobs j JOIN employer_listings l ON l.job_id=j.id WHERE j.id=? AND j.listed=1 AND l.apply_mode='internal' AND l.closed_at IS NULL AND l.expires_at>?)`)
    .bind(id,tenantId,raw.jobId,user.id,raw.name,user.email.toLowerCase(),raw.profileUrl||null,raw.note,key,now,now,raw.jobId,now),
   env.DB.prepare(`INSERT OR IGNORE INTO notification_outbox(id,user_id,application_id,kind,subject,body,destination_path,created_at)
    SELECT ?,?,?, 'application_received',?,?, '/employer/applications',? WHERE EXISTS(SELECT 1 FROM job_applications WHERE id=?)`)
    .bind('application:'+id,job.user_id,id,'New application: '+job.title,'A candidate applied to your job. Sign in to review their application and CV.',now,id),
  ]);
  if(!await env.DB.prepare('SELECT id FROM job_applications WHERE id=?').bind(id).first()){
   if(key){await env.FILES.delete?.(key);key=null;}
   const duplicate=await env.DB.prepare('SELECT id,status FROM job_applications WHERE job_id=? AND email=?').bind(raw.jobId,user.email.toLowerCase()).first<{id:string;status:string}>();
   if(duplicate?.status==='withdrawn')throw new Error('You withdrew this application. It has not been submitted again.');
   if(!duplicate)throw new Error('This job is no longer accepting applications');
  }
 }catch(error){if(key)await env.FILES.delete?.(key);throw error;}
}
export async function applicationFile(db:Database,userId:string,id:string){
 return db.prepare(`SELECT a.cv_r2_key FROM job_applications a JOIN employer_listings l ON l.job_id=a.job_id JOIN jobs j ON j.id=a.job_id WHERE a.id=? AND a.status!='withdrawn' AND (a.user_id=? OR ${JOB_ACCESS_SQL})`).bind(id,userId,userId,userId).first<string>('cv_r2_key');
}
export async function updateApplication(db:Database,employerId:string,id:string,status:string,note:string){
 if(!(APPLICATION_STATUSES as readonly string[]).includes(status)||note.length>4000)throw new Error('Invalid application update');
 const application=await db.prepare(`SELECT a.user_id,a.status,j.title FROM job_applications a JOIN employer_listings l ON l.job_id=a.job_id JOIN jobs j ON j.id=a.job_id WHERE a.id=? AND a.status!='withdrawn' AND ${JOB_ACCESS_SQL}`).bind(id,employerId,employerId).first<{user_id:string|null;status:string;title:string}>();if(!application)throw Error('Application not found');
 const at=new Date().toISOString(),event=crypto.randomUUID(),guard=`EXISTS(SELECT 1 FROM job_applications a JOIN employer_listings l ON l.job_id=a.job_id JOIN jobs j ON j.id=a.job_id WHERE a.id=? AND ${JOB_ACCESS_SQL} AND a.status!='withdrawn')`;
 await db.batch([
 db.prepare(`INSERT INTO application_stage_history(id,application_id,stage,changed_by,created_at) SELECT ?,?,?,?,? WHERE ${guard} AND EXISTS(SELECT 1 FROM job_applications WHERE id=? AND status<>?)`).bind(event,id,status,employerId,at,id,employerId,employerId,id,status),
 db.prepare(`UPDATE job_applications SET status=?,employer_note=?,updated_at=? WHERE id=? AND ${guard}`).bind(status,note.trim(),at,id,id,employerId,employerId),
 db.prepare(`INSERT OR IGNORE INTO notification_outbox(id,user_id,application_id,kind,subject,body,destination_path,created_at) SELECT ?,?,?,'application_stage',?,?, '/account/applications',? WHERE EXISTS(SELECT 1 FROM application_stage_history WHERE id=?) AND EXISTS(SELECT 1 FROM candidate_subscriptions WHERE user_id=? AND status IN ('active','trialing') AND renews_at>?)`)
 .bind('stage:'+event,application.user_id,id,'Application update: '+application.title,'Your application is now '+status+'.',at,event,application.user_id,at),
 ]);
}
