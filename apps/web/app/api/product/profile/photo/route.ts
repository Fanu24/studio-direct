import {platform,currentUser,sameOrigin} from '../../../../../lib/platform';
import {refreshCandidateCompleteness} from '../../../../../lib/product/candidates';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response('Forbidden',{status:403});if(Number(request.headers.get('content-length'))>3*1024*1024)return new Response('Photo too large',{status:413});
 const env=await platform(),user=await currentUser(env,request);if(!user)return new Response('Sign in',{status:401});
 const file=(await request.formData()).get('photo');if(!(file instanceof File)||file.size>2*1024*1024||!file.size)return new Response('Upload an image up to 2 MB',{status:400});
 const bytes=new Uint8Array(await file.arrayBuffer()),ascii=new TextDecoder().decode(bytes.slice(0,12));
 const type=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'image/jpeg':bytes[0]===137&&ascii.slice(1,4)==='PNG'?'image/png':ascii.startsWith('RIFF')&&ascii.slice(8)==='WEBP'?'image/webp':null;
 if(!type)return new Response('Use a JPEG, PNG or WebP photo',{status:400});
 await env.FILES.put('profile-photos/'+user.id,bytes.buffer as ArrayBuffer,{httpMetadata:{contentType:type}});
 await env.DB.prepare('INSERT INTO profiles(user_id,photo_url) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET photo_url=excluded.photo_url').bind(user.id,'/api/product/profile/photo/'+encodeURIComponent(user.id)).run();await refreshCandidateCompleteness(env.DB,user.id);
 return Response.redirect(new URL('/account/profile',request.url),303);
}
