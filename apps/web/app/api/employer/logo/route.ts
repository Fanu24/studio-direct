import { platform,currentUser,sameOrigin,appOrigin } from '../../../../lib/platform';
export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:'Invalid request origin'},{status:403});
  const env=await platform(),user=await currentUser(env,request);
  if(!user)return Response.json({error:'Sign in before uploading a logo'},{status:401});
  const form=await request.formData(),file=form.get('logo');
  if(!(file instanceof File)||file.size>2*1024*1024||file.size===0)return Response.json({error:'Choose a PNG, JPEG or WebP image up to 2 MB'},{status:400});
  const data=await file.arrayBuffer(),bytes=new Uint8Array(data);
  const type=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':
    bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':
    String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
  if(!type)return Response.json({error:'Invalid image format'},{status:400});
  const key=`logos/${user.id}/${crypto.randomUUID()}`;
  await env.FILES.put(key,data,{httpMetadata:{contentType:type}});
  return Response.json({url:`${appOrigin(env)}/api/media/${key}`});
}
