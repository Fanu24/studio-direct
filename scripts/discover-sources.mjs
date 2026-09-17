/** Discover source candidates, without publishing jobs. Node >=22. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1];
const out=args.includes('--output')?resolve(value('--output')):resolve(root,'.wrangler/source-candidates.json');
const limit=Math.min(500,Math.max(1,Number(args.includes('--limit')?value('--limit'):500)));
const ua=process.env.CRAWLER_USER_AGENT||'NodeworkSourceDiscovery/1.0';
const privateIP=ip=>ip.includes(':')||/^(0|10|127|169\.254|172\.(1[6-9]|2\d|3[01])|192\.168|224|240)\./.test(ip);
async function publicURL(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||isIP(url.hostname)||!url.hostname.includes('.'))throw Error('Public HTTPS hostname required');const hosts=await lookup(url.hostname,{all:true});if(!hosts.length||hosts.some(h=>h.family===4&&privateIP(h.address)||h.family===6&&(/^(::|fc|fd|fe80)/i.test(h.address))))throw Error('Private address rejected');return url;}
async function text(url,headers={}){
 for(let i=0;i<5;i++){
  const u=await publicURL(url);const response=await fetch(u,{headers:{'User-Agent':ua,...headers},redirect:'manual',signal:AbortSignal.timeout(15000)});
  if([301,302,303,307,308].includes(response.status)){url=new URL(response.headers.get('location'),u).href;headers={};continue;}
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const reader=response.body.getReader(),parts=[];let bytes=0;
  for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2_000_000){await reader.cancel();throw Error('Response too large');}parts.push(Buffer.from(value));}
  return {body:Buffer.concat(parts).toString('utf8'),url:u.href};
 }throw Error('Redirect limit');
}
function links(html,base){const result=[];for(const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){try{const url=new URL(match[1].replaceAll('&amp;','&'),base);if(url.protocol==='https:')result.push({url:url.href,label:match[2].replace(/<[^>]*>/g,' ')});}catch{}}return result;}
function ats(url){const u=new URL(url),slug=u.pathname.split('/').filter(Boolean)[0];if(!slug)return null;const type=({'boards.greenhouse.io':'greenhouse','job-boards.greenhouse.io':'greenhouse','jobs.lever.co':'lever','jobs.ashbyhq.com':'ashby'})[u.hostname];return type?{ats_type:type,ats_slug:slug,career_url:`${u.origin}/${slug}`} : null;}
// Conservatively skip any site that disallows a path for all bots or this bot.
async function allowed(url){const u=new URL(url);try{const robots=(await text(new URL('/robots.txt',u).href)).body;let applies=false;for(const line of robots.split(/\r?\n/)){const [key,...parts]=line.replace(/#.*/,'').split(':');const val=parts.join(':').trim();if(key.trim().toLowerCase()==='user-agent')applies=val==='*'||/nodework/i.test(val);if(applies&&key.trim().toLowerCase()==='disallow'&&val&&u.pathname.startsWith(val.replace(/\*.*$/,'')))return false;}}catch(e){if(!String(e).includes('HTTP 404'))return false;}return true;}
let companies;
if(args.includes('--from-cmc')){
 const key=process.env.CMC_API_KEY;if(!key)throw Error('Set CMC_API_KEY or use --input companies.json');
 const cmc=async path=>JSON.parse((await text('https://pro-api.coinmarketcap.com'+path,{'X-CMC_PRO_API_KEY':key})).body).data;
 const assets=await cmc(`/v3/cryptocurrency/listings/latest?limit=${limit}&sort=market_cap`);companies=[];
 for(let i=0;i<assets.length;i+=50){const info=await cmc('/v2/cryptocurrency/info?id='+assets.slice(i,i+50).map(a=>a.id).join(','));for(const asset of assets.slice(i,i+50)){const entry=info[asset.id];if(entry?.urls?.website?.[0])companies.push({name:asset.name,website:entry.urls.website[0],origin:`coinmarketcap:${asset.id}`});}}
}else if(args.includes('--input'))companies=JSON.parse(readFileSync(resolve(value('--input')),'utf8'));
else throw Error('Usage: node scripts/discover-sources.mjs --input companies.json [--limit 500] or --from-cmc');
if(!Array.isArray(companies))throw Error('Input must be an array of {name,website}');
const seen=new Set(),results=[];
for(const company of companies.slice(0,limit)){
 const result={name:String(company.name||'').slice(0,160),website:String(company.website||''),origin:company.origin||'provided',approved:false};
 try{
  const url=await publicURL(result.website);if(seen.has(url.hostname))continue;seen.add(url.hostname);
  if(!await allowed(url.href))throw Error('robots.txt denied or unavailable');
  const home=await text(url.href);let candidates=links(home.body,home.url);
  let board=candidates.map(l=>ats(l.url)).find(Boolean);
  if(!board){const career=candidates.find(l=>/careers?|jobs|join our team|work with us/i.test(l.url+' '+l.label));if(career&&await allowed(career.url)){const page=await text(career.url);board=links(page.body,page.url).map(l=>ats(l.url)).find(Boolean)||{career_url:page.url,ats_type:null,ats_slug:null};}}
  if(board)Object.assign(result,board,{status:board.ats_type?'ats_found':'review_jsonld'});else result.status='no_career_link';
 }catch(error){result.status='unresolved';result.error=error.message;}
 results.push(result);console.log(`${results.length}: ${result.name} — ${result.status}`);
 await new Promise(resolve=>setTimeout(resolve,250));
}
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(results,null,2)+'\n');
console.log(`Saved ${results.length} candidates to ${out}. Review company identity and set approved:true for sources to import. Token rankings are not a list of hiring companies.`);
