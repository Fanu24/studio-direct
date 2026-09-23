import {resolveJobRole} from './taxonomy';
import {SALARY_CURRENCIES} from './fields';
import type {ProductDatabase} from './notifications';
export type ExternalSalary={min:number;max:number;currency:string;period:'yearly'|'monthly'|'hourly'};
function salaryPeriod(unit:unknown):ExternalSalary['period']|null{const value=String(unit??'').toLowerCase();return /^(year|yearly|annual|annually|annum)$/.test(value)?'yearly':/^(month|monthly)$/.test(value)?'monthly':/^(hour|hourly)$/.test(value)?'hourly':null;}
function bounded(min:unknown,max:unknown,currency:unknown,unit:unknown):ExternalSalary|null{const lower=Number(min),upper=Number(max),code=String(currency??'').toUpperCase(),period=salaryPeriod(unit);if(!period||!(SALARY_CURRENCIES as readonly string[]).includes(code)||!Number.isFinite(lower)||!Number.isFinite(upper)||lower<=0||upper<lower||upper>1e9)return null;return {min:lower,max:upper,currency:code,period};}
/** Extract explicitly stated compensation; never consume an aggregator's estimated salary. */
export function externalSalary(input:{salaryText?:string|null;descriptionHtml?:string;rawJson?:string|null;source?:string;salaryMin?:number|null;salaryMax?:number|null}):ExternalSalary|null{
 let raw:Record<string,any>={};try{raw=JSON.parse(input.rawJson??'{}');}catch{}
 if(raw.baseSalary){const salary=raw.baseSalary,value=salary.value;const result=bounded(value?.minValue??value?.value,value?.maxValue??value?.value,salary.currency,value?.unitText);if(result)return result;}
 if(input.source==='web3_career_api'){const result=bounded(raw.salary_min_value,raw.salary_max_value,raw.salary_currency??'USD',raw.salary_unit??'year');if(result)return result;}
 const text=(input.salaryText??'')+' '+(input.descriptionHtml??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ');
 const pattern=/(USD|EUR|GBP|CHF|CAD|AUD|SGD|AED|JPY|HKD|INR|BRL|PLN|SEK|NOK|DKK|CZK|TRY|MXN|ZAR)?\s*([$€£])?\s*(\d[\d,]*(?:\.\d+)?)\s*([kK])?\s*(?:-|–|—|to)\s*([$€£])?\s*(\d[\d,]*(?:\.\d+)?)\s*([kK])?\s*(USD|EUR|GBP|CHF|CAD|AUD|SGD|AED|JPY|HKD|INR|BRL|PLN|SEK|NOK|DKK|CZK|TRY|MXN|ZAR)?\s*(?:per|\/|a)?\s*(yearly|year|annually|annual|annum|monthly|month|hourly|hour)\b/gi;
 for(const m of text.matchAll(pattern)){const symbol=m[2]??m[5],currency=m[1]??m[8]??(symbol==='€'?'EUR':symbol==='£'?'GBP':symbol==='$'?'USD':null);if(!currency)continue;const result=bounded(Number(m[3].replaceAll(',',''))*(m[4]?1000:1),Number(m[6].replaceAll(',',''))*(m[7]?1000:1),currency,m[9]);if(result)return result;}
 return null;
}
export type SalaryInsight={count:number;median:number;q1:number;q3:number;min:number;max:number;cryptoPercent:number;arrangements:Record<string,number>;examples:{id:string;slug:string;title:string;company:string}[]};
export function salaryDistribution(rows:{min:number;max:number;crypto:number;remote:string;id:string;slug:string;title:string;company:string}[]):SalaryInsight|null{
 if(rows.length<5)return null;const mids=rows.map(r=>(r.min+r.max)/2).sort((a,b)=>a-b),quantile=(p:number)=>{const index=(mids.length-1)*p,base=Math.floor(index);return Math.round(mids[base]+(mids[Math.min(base+1,mids.length-1)]-mids[base])*(index-base));};
 const arrangements:Record<string,number>={};for(const row of rows)arrangements[row.remote]=(arrangements[row.remote]??0)+1;
 return {count:rows.length,median:quantile(.5),q1:quantile(.25),q3:quantile(.75),min:Math.min(...rows.map(r=>r.min)),max:Math.max(...rows.map(r=>r.max)),cryptoPercent:Math.round(rows.filter(r=>r.crypto===1).length/rows.length*100),arrangements,examples:rows.slice(0,5).map(({id,slug,title,company})=>({id,slug,title,company}))};
}
export async function rebuildSalaryInsights(db:ProductDatabase,tenantId:string,now=new Date()){
 const date=now.toISOString().slice(0,10),at=now.toISOString();if(await db.prepare('SELECT kind FROM product_daily_runs WHERE kind=? AND date=?').bind('salaries:'+tenantId,date).first())return;
 const roleRows=await db.prepare('SELECT id,name,slug,aliases_json,patterns_json FROM job_roles').bind().all<{id:string;name:string;slug:string;aliases_json:string;patterns_json:string}>(),roles=roleRows.results.map(r=>({...r,aliases:JSON.parse(r.aliases_json) as string[],patterns:JSON.parse(r.patterns_json) as string[]}));
 const rates=await db.prepare('SELECT currency,rate_to_usd FROM fx_rates WHERE updated_at>=? AND updated_at<=?').bind(new Date(now.getTime()-7*86400000).toISOString(),new Date(now.getTime()+3600000).toISOString()).all<{currency:string;rate_to_usd:number}>(),fx=new Map(rates.results.map(r=>[r.currency,r.rate_to_usd]));fx.set('USD',1);
 const countries=await db.prepare('SELECT code,name FROM reference_countries').bind().all<{code:string;name:string}>();
 const cohorts=new Map<string,Parameters<typeof salaryDistribution>[0]>();let after='';
 for(;;){const page=await db.prepare(`SELECT j.id,j.slug,j.title,c.name AS company,j.remote,j.salary_min,j.salary_max,j.salary_currency,j.salary_period,j.salary_text,j.source,j.description_html,j.crypto_payment_available,
 (SELECT GROUP_CONCAT(location_slug,',') FROM job_locations WHERE job_id=j.id) locations FROM jobs j JOIN companies c ON c.id=j.company_id
 WHERE j.tenant_id=? AND j.id>? AND j.listed=1 AND j.confidential=0 AND c.listed=1 AND j.commercial_origin='aggregated' AND j.source<>'manual' AND (j.expires_at IS NULL OR j.expires_at>?) ORDER BY j.id LIMIT 200`).bind(tenantId,after,at).all<Record<string,any>>();
  const updates=[];for(const row of page.results){const roleId=resolveJobRole(row.title,roles),role=roles.find(r=>r.id===roleId);if(!role)continue;
   const stated=row.salary_currency&&row.salary_period?bounded(row.salary_min,row.salary_max,row.salary_currency,row.salary_period):row.source==='web3_career_api'?bounded(row.salary_min,row.salary_max,'USD','year'):externalSalary({salaryText:row.salary_text,descriptionHtml:row.description_html});
   if(!stated)continue;const rate=fx.get(stated.currency);if(!rate||rate<=0)continue;const multiple=stated.period==='monthly'?12:stated.period==='hourly'?2080:1,min=stated.min*rate*multiple,max=stated.max*rate*multiple;if(!Number.isFinite(min)||!Number.isFinite(max)||min<=0||max<min)continue;
   const sample={id:row.id,slug:row.slug,title:row.title,company:row.company,remote:row.remote??'unknown',crypto:row.crypto_payment_available,min,max};
   const locations=new Set(['all',...(row.remote==='remote'?['remote']:[])]),slugs=String(row.locations??'').split(',');for(const c of countries.results){const slug=c.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(slugs.includes(slug)||slugs.includes(c.code.toLowerCase()))locations.add(slug);}
   for(const location of locations){const key=role.slug+'|'+location;const list=cohorts.get(key)??[];list.push(sample);cohorts.set(key,list);}
   updates.push(db.prepare('UPDATE jobs SET job_role_id=?,salary_min=?,salary_max=?,salary_currency=?,salary_period=? WHERE id=? AND commercial_origin=\'aggregated\'').bind(role.id,stated.min,stated.max,stated.currency,stated.period,row.id));
  }
  for(let offset=0;offset<updates.length;offset+=50)await db.batch(updates.slice(offset,offset+50));
  if(page.results.length<200)break;after=page.results.at(-1)!.id;
 }
 for(const [key,rows] of cohorts){const stats=salaryDistribution(rows);if(!stats)continue;const [role,location]=key.split('|');await db.prepare('INSERT OR REPLACE INTO salary_stats(role_slug,location_slug,as_of,stats_json) VALUES(?,?,?,?)').bind(role,location,date,JSON.stringify(stats)).run();}
 await db.prepare('INSERT OR IGNORE INTO product_daily_runs VALUES(?,?,?)').bind('salaries:'+tenantId,date,at).run();
}
