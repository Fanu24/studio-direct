import { platform,currentUser,sameOrigin } from '../../../../lib/platform';
import { parseListing } from '../../../../lib/billing/listing-input';
import { redeemCredit } from '../../../../lib/billing/employer-orders';
export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:'Invalid request origin'},{status:403});
  const env=await platform(),user=await currentUser(env,request);
  if(!user)return Response.json({error:'Sign in first'},{status:401});
  try {const raw=await request.json();const jobId=await redeemCredit(env.DB,user.id,String(raw.creditId),parseListing(raw.listing,user.email));
    return Response.json({url:`/employer?published=${encodeURIComponent(jobId)}`});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Invalid request'},{status:400});}
}
