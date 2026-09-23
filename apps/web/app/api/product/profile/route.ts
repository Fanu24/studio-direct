import {platform,currentUser,sameOrigin} from '../../../../lib/platform';
import {requireTenantId} from '../../../../lib/tenant';
import {loadProductFlags} from '../../../../lib/product/flags';
import {saveCandidateProfile} from '../../../../lib/product/candidates';
export async function POST(request:Request){
  if(!sameOrigin(request))return new Response('Forbidden',{status:403});
  if(Number(request.headers.get('content-length'))>100000)return new Response('Profile too large',{status:413});
  const env=await platform(),user=await currentUser(env,request);if(!user)return Response.json({error:'Sign in first.'},{status:401});
  if(!(await loadProductFlags(env.DB,await requireTenantId(env.DB),env)).PRODUCT_PROFILES_V2)return new Response('Not available',{status:404});
  try{return Response.json(await saveCandidateProfile(env.DB,user.id,await request.json()));}catch(error){return Response.json({error:error instanceof Error?error.message:'Could not save profile.'},{status:400});}
}
