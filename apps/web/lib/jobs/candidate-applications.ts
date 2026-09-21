import type {Database,PlatformEnv} from '../platform';
import {cvUploadRejection} from '../profile/cv';
import {parseApplyInput} from './apply';
export const APPLICATION_STATUSES=['new','reviewing','shortlisted','interview','rejected','hired'] as const;
export async function submitCandidateApplication(env:Pick<PlatformEnv,'DB'|'FILES'>,user:{id:string;email:string},tenantId:string,form:FormData){
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
 return db.prepare(`SELECT a.cv_r2_key FROM job_applications a JOIN employer_listings l ON l.job_id=a.job_id WHERE a.id=? AND a.status!='withdrawn' AND (a.user_id=? OR l.user_id=?)`).bind(id,userId,userId).first<string>('cv_r2_key');
}
export async function updateApplication(db:Database,employerId:string,id:string,status:string,note:string){
 if(!(APPLICATION_STATUSES as readonly string[]).includes(status)||note.length>4000)throw new Error('Invalid application update');
 const result=await db.prepare(`UPDATE job_applications SET status=?,employer_note=?,updated_at=? WHERE id=? AND status!='withdrawn' AND job_id IN(SELECT job_id FROM employer_listings WHERE user_id=?)`).bind(status,note.trim(),new Date().toISOString(),id,employerId).run();
 if(!result.meta?.changes)throw new Error('Application not found');
}
