import type {JobDraft} from '@gaming/shared';
import {fetchPublicText} from '../http/public-fetch';
// Public API: https://developers.ashbyhq.com/docs/public-job-posting-api
export function parseAshbyPostings(body:string,companyName:string):JobDraft[]{
 const payload=JSON.parse(body) as {jobs?:Array<Record<string,unknown>>};
 if(!Array.isArray(payload.jobs))throw new Error('Invalid Ashby board');
 return payload.jobs.filter(j=>j.isListed===true).map(j=>{
  if(typeof j.title!=='string'||typeof j.jobUrl!=='string'||typeof j.applyUrl!=='string')throw new Error('Incomplete Ashby posting');
  for(const value of [j.jobUrl,j.applyUrl]){const u=new URL(value);if(!['https:','http:'].includes(u.protocol))throw new Error('Invalid Ashby URL');}
  const compensation=j.compensation as {scrapeableCompensationSalarySummary?:string}|undefined;
  return {source:'career_page',sourceUrl:j.jobUrl,companyName,title:j.title,location:typeof j.location==='string'?j.location:null,
   remote:j.workplaceType==='Hybrid'?'hybrid':j.isRemote===true||j.workplaceType==='Remote'?'remote':j.workplaceType==='OnSite'?'onsite':'unknown',
   descriptionHtml:typeof j.descriptionHtml==='string'?j.descriptionHtml:'',applyUrl:j.applyUrl,
   postedAt:typeof j.publishedAt==='string'?j.publishedAt:null,salaryText:compensation?.scrapeableCompensationSalarySummary??null,rawJson:JSON.stringify(j)};
 });
}
export async function fetchAshbyPostings(slug:string,companyName:string,fetchImpl:typeof fetch){
 const response=await fetchPublicText(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`,fetchImpl,'NodeworkBot/1.0');
 if(response.status<200||response.status>=300)throw new Error(`Ashby board failed: ${response.status}`);
 return parseAshbyPostings(response.body,companyName);
}
