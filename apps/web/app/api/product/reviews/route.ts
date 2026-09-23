import {platform,currentUser,sameOrigin} from '../../../../lib/platform';
import {requireTenantId} from '../../../../lib/tenant';
import {loadProductFlags} from '../../../../lib/product/flags';
import {submitCompanyReview,respondToReview} from '../../../../lib/product/reviews';
export async function POST(request:Request){if(!sameOrigin(request))return new Response('Forbidden',{status:403});if(Number(request.headers.get('content-length'))>6*1024*1024)return new Response('Too large',{status:413});const env=await platform(),user=await currentUser(env,request);if(!user||!user.emailVerified)return new Response('Verified account required',{status:401});const tenant=await requireTenantId(env.DB);if(!(await loadProductFlags(env.DB,tenant,env)).PRODUCT_REVIEWS)return new Response('Not available',{status:404});
 try{const f=await request.formData(),action=String(f.get('action'));if(action==='respond')await respondToReview(env.DB,tenant,user.id,String(f.get('reviewId')),String(f.get('body')));
 else if(action==='report'){const id=String(f.get('reviewId')),reason=String(f.get('reason')??'').trim();if(reason.length<10||reason.length>2000)throw Error('Explain your report in 10–2000 characters.');await env.DB.prepare("INSERT OR IGNORE INTO review_reports(id,review_id,user_id,reason,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM company_reviews WHERE id=? AND tenant_id=? AND status='published')").bind(crypto.randomUUID(),id,user.id,reason,new Date().toISOString(),id,tenant).run();}
 else await submitCompanyReview(env,{tenantId:tenant,userId:user.id,form:f});return Response.redirect(new URL('/account/reviews?saved=1',request.url),303);
 }catch(error){return new Response(error instanceof Error?error.message:'Unable to save review',{status:400});}}
