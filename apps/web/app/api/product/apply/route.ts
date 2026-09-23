import {platform,currentUser,sameOrigin} from '../../../../lib/platform';
import {requireTenantId} from '../../../../lib/tenant';
import {recordNativeApplication,subscribeEarlyReminder} from '../../../../lib/product/applications';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response('Forbidden',{status:403});if(Number(request.headers.get('content-length'))>6*1024*1024)return new Response('Too large',{status:413});
 const env=await platform(),user=await currentUser(env,request),tenant=await requireTenantId(env.DB),f=await request.formData(),jobId=String(f.get('jobId')??'');
 try{if(f.get('action')==='remind'){if(!user)return new Response('Sign in first',{status:401});await subscribeEarlyReminder(env.DB,tenant,jobId,user.id);return Response.redirect(new URL('/notifications?reminder=1',request.url),303);}
 if(user&&f.get('share_application')!=='1')throw Error('Confirm sharing your profile with this employer.');
 const mode=f.get('mode')==='redirect'?'redirect':'email';const result=await recordNativeApplication(env,{tenantId:tenant,jobId,user,mode,form:f});
 return Response.redirect(result.url??new URL('/account/applications?sent=1',request.url).href,303);
 }catch(error){return new Response(error instanceof Error?error.message:'Unable to submit application',{status:400});}
}
