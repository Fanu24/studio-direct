import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {lookup} from 'node:dns/promises';
import {coinMarketCapSeeds,defiLlamaSeeds,cryptoPortfolioSeeds,discoverCompany,publicHttps} from '../packages/shared/src/source-discovery.ts';
import {CURATED_WEB3_COMPANIES} from '../packages/shared/src/web3-companies.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
function option(name,fallback){const index=args.indexOf(name);if(index<0)return fallback;if(!args[index+1]||args[index+1].startsWith('--'))throw Error('Missing value for '+name);return args[index+1];}
const output=resolve(option('--output',resolve(root,'.wrangler/source-candidates.json'))),limit=Number(option('--limit',args.includes('--from-cmc')?'500':'1000'));
const fetchPublic=async(input,init)=>{
 const url=publicHttps(String(input)),addresses=await lookup(url.hostname,{all:true});
 if(!addresses.length||addresses.some(({address:a})=>/^(0|10|127|169\.254|172\.(1[6-9]|2\d|3[01])|192\.168|224|240)\./.test(a)||/^(::|fc|fd|fe80)/i.test(a)))throw Error('Private network address rejected');
 return fetch(url,init);
};
let seeds;
const input=option('--input');
if(args.includes('--curated-only')){seeds=[];}
else if(input){
 seeds=JSON.parse(readFileSync(resolve(input),'utf8')).map((s,index)=>({...s,id:s.id??'provided:'+index,origin:s.origin??'curated'}));
}else {
 seeds=args.includes('--from-cmc')?await coinMarketCapSeeds({key:process.env.CMC_API_KEY,limit,fetcher:fetchPublic}):[...await defiLlamaSeeds({limit,fetcher:fetchPublic}),...await cryptoPortfolioSeeds(fetchPublic)];
}
if(!input||args.includes('--include-curated'))seeds.push(...CURATED_WEB3_COMPANIES);
seeds=[...new Map(seeds.map(seed=>[seed.id,seed])).values()];
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output.replace(/\.json$/,'')+'.catalog.json',JSON.stringify({generated_at:new Date().toISOString(),seeds},null,2)+'\n');
console.log('Catalog: '+JSON.stringify(seeds.reduce((totals,s)=>(totals[s.origin]=(totals[s.origin]??0)+1,totals),{})));
if(args.includes('--catalog-only'))process.exit(0);
const previous=args.includes('--resume')&&existsSync(output)?JSON.parse(readFileSync(output,'utf8')):[];
const done=new Map(previous.filter(s=>Date.parse(s.checked_at)>Date.now()-86400000).map(s=>[s.id,s]));
let cursor=0;const bySite=new Map();
const persist=()=>{const temp=output+'.tmp';writeFileSync(temp,JSON.stringify(seeds.map(s=>done.get(s.id)).filter(Boolean),null,2)+'\n');renameSync(temp,output);};
async function worker(){
 while(cursor<seeds.length){
  const seed=seeds[cursor++],old=done.get(seed.id);
  if(old&&old.website===seed.website)continue;
  const site=seed.career_url??seed.website;
  if(!bySite.has(site))bySite.set(site,discoverCompany(seed,fetchPublic));
  const found=await bySite.get(site),result={...found,...seed,status:found.status,career_url:found.career_url,ats_type:found.ats_type,ats_slug:found.ats_slug,error:found.error,checked_at:found.checked_at};
  done.set(seed.id,result);persist();
  console.log(done.size+'/'+seeds.length+' '+seed.name+' — '+result.status);
  await new Promise(resolve=>setTimeout(resolve,300));
 }
}
await Promise.all(Array.from({length:4},()=>worker()));
persist();
console.log('Complete: '+JSON.stringify([...done.values()].reduce((a,s)=>(a[s.status]=(a[s.status]??0)+1,a),{})));
console.log('Saved '+output);
