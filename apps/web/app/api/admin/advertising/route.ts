import {platform,sameOrigin,appOrigin} from '../../../../lib/platform';
import {adminUser} from '../../../../lib/admin';
import {parseAdvertising} from '../../../../lib/advertising';
export async function POST(request:Request){if(!sameOrigin(request))return new Response('Forbidden',{status:403});const env=await platform();if(!await adminUser(env,request))return new Response('Forbidden',{status:403});
 try{const form=await request.formData(),config=parseAdvertising(Object.fromEntries(form));if(config.mode!=='off'&&form.get('cmpPublished')!=='1')throw new Error('Publish and verify your Google privacy message first');if(config.mode==='live'&&!appOrigin(env).startsWith('https:'))throw new Error('Live ads require the approved HTTPS site');await env.DB.prepare("INSERT INTO marketplace_settings(key,value) VALUES('advertising',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(config)).run();return Response.redirect(new URL('/admin/advertising',request.url),303);}
 catch(e){return new Response(e instanceof Error?e.message:'Invalid advertising setup',{status:400});}
}
