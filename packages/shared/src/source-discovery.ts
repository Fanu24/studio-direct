export type SourceSeed={id:string;name:string;website:string;origin:'coinmarketcap'|'curated'|'defillama'|'a16z_crypto';rank?:number;career_url?:string};
export type SourceCandidate=SourceSeed&{status:'ats_found'|'jsonld_found'|'needs_review'|'needs_adapter'|'no_career_link'|'blocked'|'error';career_url?:string;ats_type?:string|null;ats_slug?:string|null;error?:string;checked_at:string};
export const DISCOVERY_USER_AGENT='NodeworkBot/1.0';
export function publicHttps(value:string):URL {
  const url=new URL(value),host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!host.includes('.')||
    /^[\d.]+$/.test(host)||host.includes(':')||/\.(localhost|local|internal|test|invalid)$/.test(host))throw new Error('Public HTTPS URL required');
  url.hash='';return url;
}
export function robotsAllowed(body:string,url:string,userAgent=DISCOVERY_USER_AGENT):boolean {
  const groups:{agents:string[];rules:{allow:boolean;path:string}[]}[]=[];
  let group={agents:[] as string[],rules:[] as {allow:boolean;path:string}[]},hadRule=false;
  for(const line of body.split(/\r?\n/)) {
    const clean=line.replace(/#.*/,'').trim(),colon=clean.indexOf(':');if(colon<0)continue;
    const key=clean.slice(0,colon).toLowerCase(),value=clean.slice(colon+1).trim();
    if(key==='user-agent') {if(hadRule){groups.push(group);group={agents:[],rules:[]};hadRule=false;}group.agents.push(value.toLowerCase());}
    else if((key==='allow'||key==='disallow')&&group.agents.length){hadRule=true;if(value)group.rules.push({allow:key==='allow',path:value});}
  }
  groups.push(group);
  const ua=userAgent.toLowerCase();
  const score=(g:typeof group)=>Math.max(-1,...g.agents.map(a=>a==='*'?0:ua.includes(a)?a.length:-1));
  const best=Math.max(-1,...groups.map(score));if(best<0)return true;
  const u=new URL(url),target=u.pathname+u.search;
  let matched=-1,allow=true;
  for(const g of groups.filter(g=>score(g)===best))for(const rule of g.rules){
    const anchored=rule.path.endsWith('$'),pattern=anchored?rule.path.slice(0,-1):rule.path;
    const regex='^'+pattern.split('*').map(p=>p.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')).join('.*')+(anchored?'$':'');
    if(new RegExp(regex).test(target)){
      const specificity=pattern.replaceAll('*','').length;
      if(specificity>matched||(specificity===matched&&rule.allow)){matched=specificity;allow=rule.allow;}
    }
  }return allow;
}
export function extractLinks(html:string,base:string):{url:string;label:string}[] {
  const found=new Map<string,string>();
  for(const match of html.matchAll(/<(?:a|iframe)\b[^>]*(?:href|src)\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)(?:<\/a>|<\/iframe>)/gi)) {
    try {const url=publicHttps(new URL(match[1].replaceAll('&amp;','&'),base).href);found.set(url.href,match[2].replace(/<[^>]*>/g,' ').trim());}catch{}
  }
  // ATS widgets frequently put the board URL in an iframe or script rather than an anchor.
  for(const match of html.replaceAll('\\/','/').matchAll(/https:\/\/(?:job-boards\.greenhouse\.io|boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com)\/[^\s"'<>\\]+/gi)) {
    try {const url=publicHttps(match[0].replaceAll('&amp;','&'));found.set(url.href,'ATS board');}catch{}
  }
  return [...found].map(([url,label])=>({url,label}));
}
export function atsBoard(value:string):{career_url:string;ats_type:string;ats_slug:string}|null {
  const u=publicHttps(value);
  const type=({'boards.greenhouse.io':'greenhouse','job-boards.greenhouse.io':'greenhouse','jobs.lever.co':'lever','jobs.ashbyhq.com':'ashby'} as Record<string,string>)[u.hostname];
  if(!type)return null;
  let slug=u.pathname.split('/').filter(Boolean)[0];
  if(type==='greenhouse'&&slug==='embed')slug=u.searchParams.get('for')??'';
  if(!slug||slug==='.'||slug==='..'||!/^[-a-z0-9_.]+$/i.test(slug))return null;
  const host=type==='greenhouse'?'https://job-boards.greenhouse.io':u.origin;
  return {ats_type:type,ats_slug:slug,career_url:host+'/'+slug};
}
/** Portfolio sites can link to other employers. An ATS link alone is not proof of company identity. */
export function boardMatchesCompany(seed:SourceSeed,slug:string):boolean {
  const compact=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const board=compact(slug),domain=new URL(seed.website).hostname.replace(/^(www|app)\./,'').split('.')[0];
  const names=[domain,seed.name,...seed.name.split(/\s+/)].map(compact)
    .filter(n=>n.length>=4&&!['labs','crypto','chain','token','global','markets','finance','digital','network','foundation','financial','protocol'].includes(n));
  return names.some(n=>board.includes(n)||n.includes(board)&&board.length>=4);
}
export function createSiteReader(fetcher:typeof fetch=fetch) {
  const robots=new Map<string,Promise<string>>();
  async function raw(value:string):Promise<{body:string;url:string;status:number}> {
    let url=publicHttps(value);
    for(let hop=0;hop<5;hop++){
      const response=await fetcher(url.href,{headers:{'user-agent':DISCOVERY_USER_AGENT},redirect:'manual',signal:AbortSignal.timeout(12000)});
      if([301,302,303,307,308].includes(response.status)){
        const location=response.headers.get('location');if(!location)throw new Error('Redirect without location');
        url=publicHttps(new URL(location,url).href);continue;
      }
      if(!response.ok&&response.status!==404)throw new Error('HTTP '+response.status);
      if(!response.body)return {body:'',url:url.href,status:response.status};
      const reader=response.body.getReader(),decoder=new TextDecoder();let body='',bytes=0;
      try {for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>5_000_000)throw new Error('Response exceeds 5 MB');body+=decoder.decode(part.value,{stream:true});}body+=decoder.decode();}
      finally {await reader.cancel().catch(()=>{});}
      return {body,url:url.href,status:response.status};
    }throw new Error('Too many redirects');
  }
  async function read(value:string) {
    let url=publicHttps(value);
    // Check each destination before following a redirect from a Careers page.
    for(let hop=0;hop<5;hop++){
      if(!robots.has(url.origin))robots.set(url.origin,raw(url.origin+'/robots.txt').then(r=>r.status===404?'':r.body));
      if(!robotsAllowed(await robots.get(url.origin)!,url.href))throw new Error('robots.txt disallows this page');
      const response=await fetcher(url.href,{headers:{'user-agent':DISCOVERY_USER_AGENT},redirect:'manual',signal:AbortSignal.timeout(12000)});
      if([301,302,303,307,308].includes(response.status)){
        const location=response.headers.get('location');if(!location)throw new Error('Redirect without location');
        url=publicHttps(new URL(location,url).href);continue;
      }
      if(!response.ok)throw new Error('HTTP '+response.status);
      const reader=response.body?.getReader();if(!reader)return {body:'',url:url.href,status:response.status};
      const decoder=new TextDecoder();let body='',bytes=0;
      try {for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>5_000_000)throw new Error('Response exceeds 5 MB');body+=decoder.decode(part.value,{stream:true});}body+=decoder.decode();}
      finally {await reader.cancel().catch(()=>{});}
      return {body,url:url.href,status:response.status};
    }throw new Error('Too many redirects');
  }
  return {read};
}
export async function discoverCompany(seed:SourceSeed,fetcher:typeof fetch=fetch):Promise<SourceCandidate> {
  const result:SourceCandidate={...seed,status:'no_career_link',checked_at:new Date().toISOString()};
  const reader=createSiteReader(fetcher);
  const foundBoard=(board:NonNullable<ReturnType<typeof atsBoard>>):SourceCandidate=>({...result,...board,
    status:boardMatchesCompany(seed,board.ats_slug)?'ats_found':'needs_review',
    ...(!boardMatchesCompany(seed,board.ats_slug)?{error:'ATS identity differs from catalog company; review before activation'}:{})});
  try {
    if(!seed.website){return {...result,status:'no_career_link',error:'No official website in catalog'};}
    const home=await reader.read(seed.career_url??seed.website);
    const direct=atsBoard(home.url);if(direct)return foundBoard(direct);
    let links=extractLinks(home.body,home.url);
    const boards=links.map(l=>atsBoard(l.url)).filter((b):b is NonNullable<typeof b>=>!!b);
    let board:ReturnType<typeof atsBoard>|undefined=boards.find(b=>boardMatchesCompany(seed,b.ats_slug));if(board)return foundBoard(board);
    if(/"@type"\s*:\s*(?:"JobPosting"|\[[^\]]*"JobPosting")/i.test(home.body))return {...result,career_url:home.url,status:'jsonld_found'};
    const careerPattern=/careers?|vacanc|join[- /]?us|join our team|work with us|(?:^|\/)jobs(?:[/?#-]|$)/i;
    const candidates=links.filter(l=>careerPattern.test(new URL(l.url).pathname+' '+l.label)).slice(0,4);
    let fallback:SourceCandidate|undefined;
    for(const candidate of candidates){
      try {
        const page=await reader.read(candidate.url);
        board=atsBoard(page.url)||extractLinks(page.body,page.url).map(l=>atsBoard(l.url)).find(Boolean);
        if(board)return foundBoard(board);
        if(/"@type"\s*:\s*(?:"JobPosting"|\[[^\]]*"JobPosting")/i.test(page.body))return {...result,career_url:page.url,status:'jsonld_found'};
        fallback={...result,career_url:page.url,status:'needs_adapter'};
      }catch(e){result.error=e instanceof Error?e.message:'Fetch failed';}
    }
    if(fallback)return fallback;
    if(boards.length)return foundBoard(boards[0]);
    if(seed.career_url)return {...result,career_url:home.url,status:'needs_adapter'};
    return result;
  }catch(e){const error=e instanceof Error?e.message:'Discovery failed';return {...result,status:/robots|HTTP 40[13]|HTTP 429/.test(error)?'blocked':'error',error};}
}
export async function coinMarketCapSeeds({key,limit=500,fetcher=fetch}:{key?:string;limit?:number;fetcher?:typeof fetch}={}):Promise<SourceSeed[]> {
  if(!Number.isInteger(limit)||limit<1||limit>500)throw new Error('CMC limit must be between 1 and 500');
  const base='https://pro-api.coinmarketcap.com'+(key?'':'/public-api');
  const get=async(path:string)=>{
    const response=await fetcher(base+path,{headers:{accept:'application/json',...(key?{'X-CMC_PRO_API_KEY':key}:{})},redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('CoinMarketCap HTTP '+response.status);
    const body=await response.json() as {status?:{error_code?:number;error_message?:string};data:any};
    if(body.status?.error_code)throw new Error('CoinMarketCap rejected the catalog request');
    return body.data;
  };
  const assets=await get('/v3/cryptocurrency/listings/latest?start=1&limit='+limit+'&sort=market_cap');
  if(!Array.isArray(assets)||assets.length!==limit)throw new Error('CoinMarketCap returned an incomplete ranking');
  const seeds:SourceSeed[]=[];
  for(let offset=0;offset<assets.length;offset+=50){
    const slice=assets.slice(offset,offset+50),info=await get('/v2/cryptocurrency/info?id='+slice.map(a=>a.id).join(','));
    for(const asset of slice){
      const metadata=info?.[String(asset.id)];
      seeds.push({id:'cmc:'+asset.id,origin:'coinmarketcap',rank:asset.cmc_rank??seeds.length+1,name:asset.name,website:metadata?.urls?.website?.[0]??''});
    }
  }
  return seeds;
}

/** Broad crypto catalog: protocols and exchanges, including projects with no token. TVL orders discovery, not employer quality. */
export async function defiLlamaSeeds({limit=1000,fetcher=fetch}:{limit?:number;fetcher?:typeof fetch}={}):Promise<SourceSeed[]> {
  if(!Number.isInteger(limit)||limit<1||limit>5000)throw new Error('Catalog limit must be between 1 and 5000');
  const response=await fetcher('https://api.llama.fi/protocols',{headers:{accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('DefiLlama catalog HTTP '+response.status);
  const rows=await response.json() as {id:string;name:string;url:string;tvl:number}[];
  if(!Array.isArray(rows))throw new Error('Invalid DefiLlama catalog');
  const seen=new Set<string>(),seeds:SourceSeed[]=[];
  for(const row of [...rows].sort((a,b)=>(Number(b.tvl)||0)-(Number(a.tvl)||0))){
    if(typeof row.name!=='string'||typeof row.id!=='string'||!row.url)continue;
    try {
      const url=publicHttps(row.url),domain=url.hostname.replace(/^(www|app)\./,'');
      if(seen.has(domain))continue;seen.add(domain);
      seeds.push({id:'llama:'+row.id,name:row.name,website:url.origin,origin:'defillama'});
      if(seeds.length===limit)break;
    }catch{}
  }
  if(!seeds.length)throw new Error('DefiLlama returned no usable company websites');
  return seeds;
}
export async function cryptoPortfolioSeeds(fetcher:typeof fetch=fetch):Promise<SourceSeed[]> {
  const page=await createSiteReader(fetcher).read('https://a16zcrypto.com/portfolio');
  const excluded=/(^|\.)(a16zcrypto\.com|a16z\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|youtu\.be|instagram\.com|facebook\.com|spotify\.com|apple\.com|substack\.com)$/;
  const seeds=new Map<string,SourceSeed>();
  for(const link of extractLinks(page.body,page.url)){
    const url=publicHttps(link.url),name=link.label.replace(/\s+/g,' ').trim();
    if(excluded.test(url.hostname)||!name||name.length>100||url.pathname!=='/')continue;
    const domain=url.hostname.replace(/^www\./,'');
    seeds.set(domain,{id:'a16z:'+domain,name,website:url.origin,origin:'a16z_crypto'});
  }
  if(seeds.size<20)throw new Error('Portfolio markup changed; retain the previous catalog');
  return [...seeds.values()];
}
