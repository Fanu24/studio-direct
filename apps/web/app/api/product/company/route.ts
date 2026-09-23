import {platform,currentUser,sameOrigin} from '../../../../lib/platform';
import {requireTenantId} from '../../../../lib/tenant';
import {canManageCompany} from '../../../../lib/product/company-claims';
import {bumpJob,inviteTeamMember,acceptTeamInvitation,companyMembership} from '../../../../lib/product/company-plans';
import {publicHttpsUrl} from '@gaming/shared';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response('Forbidden',{status:403});const env=await platform(),user=await currentUser(env,request);if(!user)return new Response('Sign in',{status:401});
 const f=await request.formData(),action=String(f.get('action')),companyId=String(f.get('companyId')??''),jobId=String(f.get('jobId')??''),tenant=await requireTenantId(env.DB);let next='/employer';
 try{
  if(action==='bump')await bumpJob(env.DB,user.id,jobId);
  else if(action==='close'){const subscription=await env.DB.prepare('SELECT o.stripe_subscription_id FROM employer_listings l JOIN employer_orders o ON o.id=l.order_id WHERE l.job_id=? AND l.user_id=?').bind(jobId,user.id).first<{stripe_subscription_id:string|null}>();if(subscription?.stripe_subscription_id){if(!env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw Error('Sandbox billing must be connected to stop renewal.');const response=await fetch('https://api.stripe.com/v1/subscriptions/'+encodeURIComponent(subscription.stripe_subscription_id),{method:'DELETE',headers:{Authorization:'Bearer '+env.STRIPE_SECRET_KEY},signal:AbortSignal.timeout(15000)});if(!response.ok){const data=await response.json() as {error?:{code?:string}};if(data.error?.code!=='resource_missing')throw Error('Could not stop renewal; the listing is unchanged.');}}const job=await env.DB.prepare('SELECT j.company_id,l.user_id FROM jobs j JOIN employer_listings l ON l.job_id=j.id WHERE j.id=? AND j.tenant_id=?').bind(jobId,tenant).first<{company_id:string;user_id:string}>();if(!job||(job.user_id!==user.id&&!await companyMembership(env.DB,user.id,job.company_id)))throw Error('Job access required.');await env.DB.batch([env.DB.prepare('UPDATE jobs SET listed=0 WHERE id=?').bind(jobId),env.DB.prepare('UPDATE employer_listings SET closed_at=? WHERE job_id=?').bind(new Date().toISOString(),jobId)]);}
  else if(action==='invite'){await inviteTeamMember(env.DB,tenant,user.id,companyId,String(f.get('email')??''));next='/employer/team?company='+companyId;}
  else if(action==='accept'){await acceptTeamInvitation(env.DB,user,String(f.get('invitation')));next='/employer/team';}
  else if(action==='remove-member'){if(!await canManageCompany(env.DB,tenant,user.id,companyId))throw Error('Verified ownership required.');await env.DB.prepare("DELETE FROM company_members WHERE company_id=? AND user_id=? AND role='member'").bind(companyId,String(f.get('member'))).run();next='/employer/team?company='+companyId;}
  else if(action==='cancel-invite'){if(!await canManageCompany(env.DB,tenant,user.id,companyId))throw Error('Verified ownership required.');await env.DB.prepare("UPDATE company_team_invitations SET status='revoked' WHERE id=? AND company_id=? AND status='pending'").bind(String(f.get('invitation')),companyId).run();next='/employer/team?company='+companyId;}
  else if(action==='edit-company'){
   if(!await canManageCompany(env.DB,tenant,user.id,companyId))throw Error('Verified ownership required.');
   const value=(key:string,max:number)=>String(f.get(key)??'').trim().slice(0,max),link=(key:string)=>{const raw=value(key,2048);if(!raw)return null;const url=publicHttpsUrl(raw);if(!url)throw Error('Use public HTTPS URLs.');return url;};
   await env.DB.prepare('UPDATE companies SET description=?,logo_url=?,banner_url=?,company_x_url=?,company_linkedin_url=?,headquarters=?,size=? WHERE id=? AND tenant_id=?').bind(value('description',5000),link('logo'),link('banner'),link('x'),link('linkedin'),value('headquarters',200),value('size',100),companyId,tenant).run();next='/employer/company?company='+companyId;
  }else throw Error('Unknown company action.');
  return Response.redirect(new URL(next,request.url),303);
 }catch(error){return new Response(error instanceof Error?error.message:'Action failed',{status:400});}
}
