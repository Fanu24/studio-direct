import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const base=new URL(process.env.SITE_URL||'http://localhost:3000');
const failures=[],warnings=[],pages=new Set(),sitemaps=new Set();
const decode=value=>String(value).replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#x27;',"'");
const local=value=>{const url=new URL(decode(value),base);if(url.origin!==base.origin)throw Error('Unexpected sitemap origin: '+url.origin);return url;};
async function read(url){const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(r.status!==200)throw Error('HTTP '+r.status);return {html:await r.text(),url:r.url};}
async function sitemap(path){
 const url=local(path);if(sitemaps.has(url.href))return;sitemaps.add(url.href);
 const {html}=await read(url);
 const expected=url.pathname==='/sitemap.xml'?'<sitemapindex':'<urlset';
 if(!html.includes(expected))throw Error('Invalid sitemap '+url.pathname);
 for(const match of html.matchAll(/<loc>([^<]+)<\/loc>/g)){
  if(!/^https?:\/\//.test(match[1]))throw Error('Sitemap URLs must be absolute');
  const target=local(match[1]);if(target.pathname.endsWith('.xml'))await sitemap(target);else {if(pages.has(target.href))throw Error('Duplicate sitemap URL: '+target.pathname);pages.add(target.href);}
 }
}
await sitemap('/sitemap.xml');
const indexedPages=new Set(pages);
for(const path of ['/post-web3-job','/post-web3-job/bundle','/ads','/web3-jobs-api','/login','/employer/login','/pricing','/legal'])pages.add(new URL(path,base).href);
if(pages.size>3000)throw Error('Catalog exceeds this audit budget: partition the catalog before running.');
const urls=[...pages];let cursor=0,checked=0;
async function worker(){while(cursor<urls.length){const href=urls[cursor++],path=new URL(href).pathname;
 try {
  const {html,url}=await read(href);
  if(!/<main\b/.test(html)||!/<h1\b/.test(html)||/Application error:/.test(html))throw Error('Missing page content');
  const canonical=html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
  if(canonical){const target=local(canonical);if(target.pathname!==new URL(url).pathname)(indexedPages.has(href)?failures:warnings).push({path,reason:'Canonical alias',canonical:target.pathname});}
  for(const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi))JSON.parse(match[1]);
  if(indexedPages.has(href)&&/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html))failures.push({path,reason:'Noindex page in sitemap'});
 }catch(error){failures.push({path,error:error.message});}
 checked++;if(checked%100===0)console.log(`Checked ${checked}/${urls.length}`);
}}
await Promise.all(Array.from({length:3},worker));
mkdirSync('.wrangler',{recursive:true});
const report={date:new Date().toISOString(),origin:base.origin,sitemaps:sitemaps.size,pages:checked,failures,warnings};
writeFileSync(resolve('.wrangler/public-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));process.exitCode=failures.length?1:0;
