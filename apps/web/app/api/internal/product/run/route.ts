import {refreshJobShortlist} from '../../../../../lib/product/talent';
import {selectDailyFeatured,rebuildSalaryInsights,enqueueSocialPosts,prepareWeeklyNewsletter,deliverSocialPosts,deliverWeeklyNewsletter} from '@gaming/shared';
import {platform} from '../../../../../lib/platform';
import {requireTenantId} from '../../../../../lib/tenant';
import {loadProductFlags} from '../../../../../lib/product/flags';
import {publishReadyAtsDrafts,syncCompanyAts} from '../../../../../lib/product/ats';
export async function POST(request:Request){const env=await platform();if(!env.PRODUCT_INTERNAL_SECRET||request.headers.get('authorization')!=='Bearer '+env.PRODUCT_INTERNAL_SECRET)return new Response('Not found',{status:404});const tenant=await requireTenantId(env.DB),flags=await loadProductFlags(env.DB,tenant,env),raw=await request.json() as {kind?:string;id?:string};
 try{if(raw.kind==='ats'&&raw.id){if(flags.PRODUCT_ATS_INTEGRATIONS)await syncCompanyAts(env,raw.id);}
 else if(raw.kind==='shortlist'&&raw.id){if(flags.PRODUCT_TALENT_SEARCH)await refreshJobShortlist(env.DB,raw.id);}
 else if(raw.kind==='salary'){if(flags.PRODUCT_SALARY_INSIGHTS)await rebuildSalaryInsights(env.DB,tenant);}
 else if(raw.kind==='tick'){await env.DB.batch([env.DB.prepare("DELETE FROM product_rate_limits WHERE window<date('now','-2 days')").bind(),env.DB.prepare("DELETE FROM candidate_access_log WHERE kind LIKE 'talent_%' AND created_at<date('now','-90 days')").bind()]);await selectDailyFeatured(env.DB,tenant);await publishReadyAtsDrafts(env,tenant);if(flags.PRODUCT_SOCIAL_SHARING){await enqueueSocialPosts(env.DB,tenant);await deliverSocialPosts(env);}if(flags.PRODUCT_NEWSLETTER){await prepareWeeklyNewsletter(env.DB,tenant);await deliverWeeklyNewsletter(env);}}
 else return new Response('Unknown task',{status:400});return Response.json({ok:true});}catch(error){console.error('Product task failed',raw.kind,error instanceof Error?error.message:'Unknown failure');return Response.json({ok:false},{status:503});}}
