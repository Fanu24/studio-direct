import {isJobTag,isCountrySlug,isCitySlug,isRegionSlug} from '@gaming/shared';
import {authorizeApiKey} from './api-keys';
import {platform,appOrigin,type PlatformEnv} from '../platform';
import {requireTenantId} from '../tenant';
import {listJobs,getJobsForListItems,jobPublicHref,type JobListFilters} from './queries';
export function apiFilters(params:URLSearchParams){
 const number=(name:string,min:number,max:number,fallback?:number)=>{const raw=params.get(name);if(raw===null)return fallback;const value=Number(raw);if(!raw.trim()||!Number.isFinite(value)||!Number.isInteger(value)||value<min||value>max)throw Error('Invalid '+name);return value;};
 const boolean=(name:string)=>{const raw=params.get(name);if(raw===null)return false;if(['true','1'].includes(raw))return true;if(['false','0'].includes(raw))return false;throw Error('Invalid '+name);};
 const tag=params.get('tag')||undefined,location=params.get('country')||params.get('location')||undefined;
 if(tag&&!isJobTag(tag))throw Error('Unknown tag');if(location&&!isCountrySlug(location)&&!isCitySlug(location)&&!isRegionSlug(location))throw Error('Unknown location');
 const filters:JobListFilters={tag,locationSlug:location,remoteOnly:boolean('remote'),page:number('page',1,10000,1),pageSize:number(params.has('limit')?'limit':'page_size',1,100,20),salaryMin:number('salary_min',0,10000000),salaryMax:number('salary_max',0,10000000)};
 for(const [param,field] of [['q','q'],['seniority','seniority']] as const){const value=params.get(param);if(value&&value.length>100)throw Error('Invalid '+param);if(value)filters[field]=value;}
 if(filters.salaryMin!=null&&filters.salaryMax!=null&&filters.salaryMin>filters.salaryMax)throw Error('Invalid salary range');
 return {filters,description:boolean('show_description')};
}
const escapeXml=(value:unknown)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export async function publicJobsApi(request:Request,format:'json'|'rss'='json',providedEnv?:PlatformEnv){
 const env=providedEnv??await platform(),url=new URL(request.url),token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||url.searchParams.get('token')||'';
 const access=await authorizeApiKey(env.DB,token),headers:Record<string,string>={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'};
 if(!access.ok)return Response.json({error:access.status===401?'Invalid or revoked API key':'Rate limit exceeded'},{status:access.status,headers:{...headers,...(access.retryAfter?{'Retry-After':String(access.retryAfter)}:{})}});
 headers['X-RateLimit-Remaining']=String(access.remaining);
 let query;try{query=apiFilters(url.searchParams);}catch(error){return Response.json({error:error instanceof Error?error.message:'Invalid filters'},{status:400,headers});}
 const tenant=await requireTenantId(env.DB),result=await listJobs(env.DB,tenant,query.filters),origin=appOrigin(env);
 const details=query.description?await getJobsForListItems(env.DB,tenant,result.jobs):[];
 const jobs=result.jobs.map((job,index)=>({id:job.id,slug:job.slug,externalId:job.externalId,title:job.title,companyName:job.companyName,companySlug:job.companySlug,companyLogoUrl:job.companyLogoUrl?new URL(job.companyLogoUrl,origin).href:null,location:job.location,remote:job.remote,salaryText:job.salaryText,salaryMin:job.salaryMin,salaryMax:job.salaryMax,postedAt:job.postedAt,tags:job.tags,apply_url:new URL(jobPublicHref(job),origin).href,...(query.description?{description:details[index]?.descriptionHtml??''}:{})}));
 if(format==='rss')return new Response('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Nodework jobs</title><link>'+escapeXml(origin+'/jobs')+'</link><description>Latest matching Web3 jobs</description>'+jobs.map(job=>'<item><guid isPermaLink="true">'+escapeXml(job.apply_url)+'</guid><title>'+escapeXml(job.title+' at '+job.companyName)+'</title><link>'+escapeXml(job.apply_url)+'</link><description>'+escapeXml('description' in job?job.description:job.location)+'</description></item>').join('')+'</channel></rss>',{headers:{...headers,'Content-Type':'application/rss+xml; charset=utf-8'}});
 return Response.json({...result,jobs},{headers});
}
