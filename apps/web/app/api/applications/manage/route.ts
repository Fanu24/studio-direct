import {platform,currentUser,sameOrigin} from '../../../../lib/platform';
import {updateApplication} from '../../../../lib/jobs/candidate-applications';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response('Forbidden',{status:403});
 const env=await platform(),user=await currentUser(env,request);if(!user)return new Response('Sign in first',{status:401});
 const form=await request.formData(),id=String(form.get('id')||'');
 if(form.get('action')==='withdraw'){
  const row=await env.DB.prepare("SELECT cv_r2_key FROM job_applications WHERE id=? AND user_id=? AND status!='withdrawn'").bind(id,user.id).first<{cv_r2_key:string|null}>();
  if(!row)return new Response('Application not found',{status:404});
  // Keep the key until storage confirms deletion so a failed request can retry.
  if(row.cv_r2_key)await env.FILES.delete?.(row.cv_r2_key);
  await env.DB.batch([
   env.DB.prepare("UPDATE job_applications SET status='withdrawn',note='',profile_url=NULL,cv_r2_key=NULL,employer_note='',updated_at=? WHERE id=? AND user_id=?").bind(new Date().toISOString(),id,user.id),
   env.DB.prepare('DELETE FROM notification_outbox WHERE application_id=? AND EXISTS(SELECT 1 FROM job_applications WHERE id=? AND user_id=?)').bind(id,id,user.id),
  ]);
  return Response.redirect(new URL('/applications',request.url),303);
 }
 try{await updateApplication(env.DB,user.id,id,String(form.get('status')),String(form.get('note')||''));}
 catch{return new Response('Application not found or invalid update',{status:400});}
 return Response.redirect(new URL('/employer/applications',request.url),303);
}
