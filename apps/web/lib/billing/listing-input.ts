import { JOB_TAGS } from '@gaming/shared';
import { httpUrl } from '../platform';
import { sanitizeJobDescriptionHtml } from '../jobs/sanitize-description';

export type ListingInput={title:string;descriptionHtml:string;companyName:string;companyUrl:string;
  location:string;remote:'remote'|'hybrid'|'onsite';applyMode:'internal'|'external';applyUrl:string;
  contactEmail:string;tags:string[];salaryMin:number|null;salaryMax:number|null;logoUrl:string;invoiceDetails:string};
export function parseListing(raw:unknown,email:string):ListingInput {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid listing');
  const r=raw as Record<string,unknown>;
  const text=(key:string,max:number)=>typeof r[key]==='string'?(r[key] as string).trim().slice(0,max):'';
  const title=text('title',150),companyName=text('companyName',160),location=text('location',160);
  const companyUrl=httpUrl(r.companyUrl);
  const descriptionHtml=sanitizeJobDescriptionHtml(text('descriptionHtml',50000));
  if(title.length<3||companyName.length<2||!companyUrl||!location||descriptionHtml.replace(/<[^>]*>/g,'').trim().length<80)throw new Error('Complete the job title, description, company website and location');
  if(!['remote','hybrid','onsite'].includes(String(r.remote)))throw new Error('Choose a work arrangement');
  if(r.applyMode!=='internal'&&r.applyMode!=='external')throw new Error('Choose how candidates apply');
  const applyUrl=r.applyMode==='external'?httpUrl(r.applyUrl):'';
  if(r.applyMode==='external'&&!applyUrl)throw new Error('Enter a valid application website');
  const tags=Array.isArray(r.tags)?[...new Set(r.tags.filter((t):t is string=>typeof t==='string'&&(JOB_TAGS as readonly string[]).includes(t)))].slice(0,12):[];
  if(!tags.length)throw new Error('Choose at least one skill');
  const salary=(v:unknown)=>v===null||v===''||v===undefined?null:typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=10000000?v:NaN;
  const salaryMin=salary(r.salaryMin),salaryMax=salary(r.salaryMax);
  if(Number.isNaN(salaryMin)||Number.isNaN(salaryMax)||(salaryMin!==null&&salaryMax!==null&&salaryMin>salaryMax))throw new Error('Invalid annual salary range');
  return {title,companyName,companyUrl,location,descriptionHtml,remote:r.remote as ListingInput['remote'],
    applyMode:r.applyMode,applyUrl:applyUrl||'',contactEmail:email,tags,salaryMin,salaryMax,
    logoUrl:httpUrl(r.logoUrl)||'',invoiceDetails:text('invoiceDetails',2000)};
}
