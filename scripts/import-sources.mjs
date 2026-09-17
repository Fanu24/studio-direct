import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {normalizeCompanyName} from '../packages/shared/src/normalize.ts';
import {atsBoard,boardMatchesCompany,publicHttps} from '../packages/shared/src/source-discovery.ts';
import {randomUUID} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),file=process.argv[2];
if(!file)throw Error('Usage: pnpm sources:import candidates.json [--activate-discovered] [--remote]');
const sources=JSON.parse(readFileSync(resolve(file),'utf8'));
if(!Array.isArray(sources))throw Error('Expected a source candidate array');
const activate=process.argv.includes('--activate-discovered'),quote=v=>v==null?'NULL':"'"+String(v).replaceAll("'","''")+"'";
const statements=[],verified=new Map(),now=new Date().toISOString(),report=[];
const allowedOrigins=['curated','defillama','a16z_crypto','coinmarketcap'];
for(const s of sources){
 if(!s.id||!s.name||!allowedOrigins.includes(s.origin))throw Error('Invalid source identity');
 if(s.website)publicHttps(s.website);
 let board=null,validation=null;
 if(s.approved===true||(activate&&s.status==='ats_found')){
  board=atsBoard(s.career_url);
  if(board&&s.approved!==true&&!boardMatchesCompany(s,board.ats_slug)){
   s.status='needs_review';s.error='ATS identity differs from catalog company; review before activation';board=null;
  }
  if(board){
   const key=board.ats_type+':'+board.ats_slug;
   if(!verified.has(key)){
    const slug=encodeURIComponent(board.ats_slug),url=board.ats_type==='greenhouse'?`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`:board.ats_type==='lever'?`https://api.lever.co/v0/postings/${slug}?mode=json`:`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;
    try {
     const r=await fetch(url,{headers:{'User-Agent':'NodeworkBot/1.0'},redirect:'error',signal:AbortSignal.timeout(20000)});
     if(!r.ok)throw Error('ATS HTTP '+r.status);
     const body=await r.json(),jobs=board.ats_type==='lever'?body:body.jobs;
     if(!Array.isArray(jobs))throw Error('Invalid ATS response');
     verified.set(key,{ok:true,jobs:jobs.filter(j=>board.ats_type!=='ashby'||j.isListed===true).length});
    }catch(e){verified.set(key,{ok:false,error:e instanceof Error?e.message:'ATS unavailable'});}
   }
   validation=verified.get(key);
  }
 }
 statements.push(`INSERT INTO source_catalog(id,origin,name,website,market_rank,career_url,ats_type,ats_slug,status,checked_at,error,updated_at) VALUES(${[s.id,s.origin,s.name,s.website,s.rank,s.career_url,s.ats_type,s.ats_slug,s.status||'pending',s.checked_at,s.error,now].map(quote).join(',')}) ON CONFLICT(id) DO UPDATE SET name=excluded.name,website=excluded.website,market_rank=excluded.market_rank,career_url=excluded.career_url,ats_type=excluded.ats_type,ats_slug=excluded.ats_slug,status=excluded.status,checked_at=excluded.checked_at,error=excluded.error,active=1,updated_at=excluded.updated_at;`);
 if((board&&validation?.ok)||(!board&&s.approved===true)){
  const career=publicHttps(board?.career_url??s.career_url).href,domain=publicHttps(s.website).hostname.replace(/^www\./,''),norm=normalizeCompanyName(s.name);
  const identity=`tenant_id=(SELECT id FROM tenants WHERE slug='nodework') AND (REPLACE(domain,'www.','')=${quote(domain)} OR name_norm=${quote(norm)}${board?` OR (ats_type=${quote(board.ats_type)} AND ats_slug=${quote(board.ats_slug)})`:''})`;
  statements.push(`INSERT INTO companies(id,tenant_id,name,name_norm,domain,career_url,ats_type,ats_slug,created_at) SELECT ${quote('discovered:'+randomUUID())},id,${quote(s.name)},${quote(norm)},${quote(domain)},${quote(career)},${quote(board?.ats_type)},${quote(board?.ats_slug)},${quote(now)} FROM tenants WHERE slug='nodework' AND NOT EXISTS(SELECT 1 FROM companies WHERE ${identity});`);
  statements.push(`UPDATE companies SET career_url=${quote(career)},ats_type=${quote(board?.ats_type)},ats_slug=${quote(board?.ats_slug)} WHERE id=(SELECT id FROM companies WHERE ${identity} ORDER BY id LIMIT 1);`);
  if(s.origin==='curated')statements.push(`UPDATE companies SET name=${quote(s.name)},name_norm=${quote(norm)} WHERE id=(SELECT id FROM companies WHERE ${identity} ORDER BY id LIMIT 1) AND NOT EXISTS(SELECT 1 FROM companies WHERE name_norm=${quote(norm)} AND tenant_id=(SELECT id FROM tenants WHERE slug='nodework'));`);
  statements.push(`UPDATE source_catalog SET company_id=(SELECT id FROM companies WHERE ${identity} ORDER BY id LIMIT 1) WHERE id=${quote(s.id)};`);
 }
 if(validation)report.push({id:s.id,name:s.name,...board,...validation});
}
// A changed identity stays in the review queue and must no longer feed an auto-discovered company.
statements.push("UPDATE companies SET career_url=NULL,ats_type=NULL,ats_slug=NULL WHERE id LIKE 'discovered:%' AND id IN(SELECT company_id FROM source_catalog WHERE status='needs_review') AND NOT EXISTS(SELECT 1 FROM source_catalog s WHERE s.company_id=companies.id AND s.status IN('ats_found','jsonld_found'));");
mkdirSync(resolve(root,'.wrangler'),{recursive:true});
const sql=resolve(root,'.wrangler/source-import.sql');writeFileSync(sql,statements.join('\n'));
writeFileSync(resolve(root,'.wrangler/source-verification.json'),JSON.stringify(report,null,2));
const remote=process.argv.includes('--remote');
const args=['d1','execute','gaming-jobs',remote?'--remote':'--local','--file',sql];if(!remote)args.push('--persist-to',resolve(root,'.wrangler/state'));
const result=spawnSync(process.execPath,[resolve(root,'apps/crawler/node_modules/wrangler/bin/wrangler.js'),...args],{cwd:resolve(root,'apps/crawler'),stdio:'inherit',env:{...process.env,XDG_CONFIG_HOME:resolve(root,'.wrangler/config'),WRANGLER_LOG_PATH:resolve(root,'.wrangler/logs')}});
console.log(JSON.stringify({catalog:sources.length,uniqueBoards:verified.size,verified:[...verified.values()].filter(v=>v.ok).length,failed:[...verified.values()].filter(v=>!v.ok).length}));
process.exitCode=result.status||0;
