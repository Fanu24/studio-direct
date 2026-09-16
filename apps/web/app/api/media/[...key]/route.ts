import { platform } from '../../../../lib/platform';
export async function GET(_request:Request,{params}:{params:Promise<{key:string[]}>}){
  const {key}=await params;
  if(key.length!==3||key[0]!=='logos'||key.some(s=>!s||s==='.'||s==='..'||/[\\\u0000-\u001f]/.test(s)))return new Response('Not Found',{status:404});
  const env=await platform(),file=await env.FILES.get(key.join('/'));
  if(!file)return new Response('Not Found',{status:404});
  return new Response(file.body,{headers:{'Content-Type':file.httpMetadata?.contentType||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=31536000,immutable'}});
}
