import {platform,currentUser,sameOrigin} from '../../../../lib/platform';
import {createApiKey,revokeApiKey} from '../../../../lib/jobs/api-keys';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response('Forbidden',{status:403});
 const env=await platform(),user=await currentUser(env,request);
 if(!user?.emailVerified)return Response.json({error:'Sign in with a verified email first'},{status:401});
 try{const body=await request.json();if(body.action==='revoke'){await revokeApiKey(env.DB,user.id,String(body.id||''));return Response.json({ok:true});}
 const result=await createApiKey(env.DB,user.id,String(body.website||''));return Response.json(result,{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Invalid request'},{status:400});}
}
