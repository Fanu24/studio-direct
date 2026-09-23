import {platform,currentUser,sameOrigin} from '../../../../lib/platform';
import {hasRecruiterAccess} from '../../../../lib/billing/marketplace';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response('Forbidden',{status:403});const env=await platform(),user=await currentUser(env,request);if(!user)return new Response('Sign in first',{status:401});
 const form=await request.formData(),id=String(form.get('candidate')||'');
 if(form.get('action')==='remove'){await env.DB.prepare('DELETE FROM recruiter_shortlist WHERE recruiter_id=? AND candidate_id=?').bind(user.id,id).run();}
 else{
  if(!await hasRecruiterAccess(env.DB,user.id))return new Response('Recruiter access required',{status:403});
  const visible=await env.DB.prepare('SELECT 1 FROM profiles WHERE user_id=? AND (public_profile=1 OR talent_pool_opt_in=1)').bind(id).first();if(!visible)return new Response('Candidate unavailable',{status:404});
  await env.DB.prepare('INSERT INTO recruiter_shortlist(recruiter_id,candidate_id,note,created_at) VALUES(?,?,?,?) ON CONFLICT(recruiter_id,candidate_id) DO UPDATE SET note=excluded.note').bind(user.id,id,String(form.get('note')||'').slice(0,4000),new Date().toISOString()).run();
 }
 return Response.redirect(new URL('/recruiter/shortlist',request.url),303);
}
