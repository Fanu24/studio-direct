import {PostingValidationError} from '@gaming/shared';
import {platform,currentUser,sameOrigin} from '../../../../../lib/platform';
import {editNativeListing} from '../../../../../lib/product/native-listings';
export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
  const env=await platform(),user=await currentUser(env,request);if(!user)return Response.json({error:'Sign in to edit your job.'},{status:401});
  try{const raw=await request.json();if(typeof raw.jobId!=='string')throw Error('Invalid listing.');const slug=await editNativeListing(env.DB,user.id,raw.jobId,raw.listing);return Response.json({url:'/jobs/'+slug});}
  catch(error){return Response.json({error:error instanceof Error?error.message:'Unable to save the job.',...(error instanceof PostingValidationError?{fields:error.fields}:{})},{status:400});}
}
