import {platform,currentUser} from '../../../../../lib/platform';
import {applicationFile} from '../../../../../lib/jobs/candidate-applications';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const env=await platform(),user=await currentUser(env,request);if(!user)return new Response('Sign in first',{status:401});
 const key=await applicationFile(env.DB,user.id,(await params).id);if(!key)return new Response('CV unavailable',{status:404});
 const object=await env.FILES.get(key);if(!object)return new Response('CV unavailable',{status:404});
 return new Response(object.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="application-cv.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
