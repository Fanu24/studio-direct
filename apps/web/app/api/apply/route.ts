import {platform,currentUser,sameOrigin} from '../../../lib/platform';
import {safeNextPath} from '../../../lib/jobs/apply';
import {submitCandidateApplication} from '../../../lib/jobs/candidate-applications';
import {requireTenantId} from '../../../lib/tenant';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response('Forbidden',{status:403});
 if(Number(request.headers.get('content-length'))>6*1024*1024)return new Response('File too large',{status:413});
 const env=await platform(),user=await currentUser(env,request),form=await request.formData(),next=safeNextPath(String(form.get('next')||'/jobs'));
 if(!user)return Response.redirect(new URL('/login?next='+encodeURIComponent(next),request.url),303);
 if(form.get('share_application')!=='1')return new Response('Confirm sharing your application with the employer',{status:400});
 try{await submitCandidateApplication(env,user,await requireTenantId(env.DB),form);return Response.redirect(new URL(next+'?sent=1',request.url),303);}
 catch(error){const reason=error instanceof Error&&error.message.startsWith('You withdrew this application')?'withdrawn':'1';return Response.redirect(new URL(next+'?error='+reason,request.url),303);}
}
