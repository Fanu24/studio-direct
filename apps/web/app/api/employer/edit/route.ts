import {platform,currentUser,sameOrigin} from '../../../../lib/platform';
import {parseListing} from '../../../../lib/billing/listing-input';
import {editListing} from '../../../../lib/billing/listing-management';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response('Forbidden',{status:403});
 const env=await platform(),user=await currentUser(env,request);if(!user)return new Response('Sign in first',{status:401});
 try{const raw=await request.json();const slug=await editListing(env.DB,user.id,String(raw.jobId),parseListing(raw.listing,user.email));return Response.json({url:'/jobs/'+slug});}
 catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to save listing'},{status:400});}
}
