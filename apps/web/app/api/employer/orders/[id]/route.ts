import {platform,currentUser} from '../../../../../lib/platform';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const env=await platform(),user=await currentUser(env,request);
  if(!user)return Response.json({error:'Sign in'},{status:401});
  const {id}=await params;
  const order=await env.DB.prepare('SELECT id,status FROM employer_orders WHERE id=? AND user_id=?').bind(id,user.id).first<{id:string;status:string}>();
  if(!order)return Response.json({error:'Order not found'},{status:404});
  return Response.json(order,{headers:{'Cache-Control':'no-store'}});
}
