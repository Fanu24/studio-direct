import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {normalizeCompanyName} from '../packages/shared/src/normalize.ts';
import {randomUUID} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),file=process.argv[2];
if(!file)throw Error('Usage: node scripts/import-sources.mjs source-candidates.json [--remote]');
const sources=JSON.parse(readFileSync(resolve(file),'utf8'));
const quote=v=>v===null?'NULL':"'"+String(v).replaceAll("'","''")+"'";
const rows=[];
for(const s of sources){if(s.approved!==true)continue;const url=new URL(s.career_url);if(url.protocol!=='https:'||!url.hostname.includes('.')||url.username||url.password)throw Error('Invalid approved source');if(s.ats_type&&!['greenhouse','lever','ashby'].includes(s.ats_type))throw Error('Unsupported ATS');if(!s.name?.trim())throw Error('Company name required');const norm=normalizeCompanyName(s.name);rows.push(`INSERT INTO companies(id,tenant_id,name,name_norm,domain,career_url,ats_type,ats_slug,created_at) SELECT ${quote(randomUUID())},id,${quote(s.name)},${quote(norm)},${quote(new URL(s.website).hostname)},${quote(url.href)},${quote(s.ats_type||null)},${quote(s.ats_slug||null)},${quote(new Date().toISOString())} FROM tenants WHERE slug='nodework' ON CONFLICT(tenant_id,name_norm) DO UPDATE SET career_url=excluded.career_url,ats_type=excluded.ats_type,ats_slug=excluded.ats_slug;`);}
if(!rows.length){console.log('No approved sources to import.');process.exit(0);}
mkdirSync(resolve(root,'.wrangler'),{recursive:true});const sql=resolve(root,'.wrangler/source-import.sql');writeFileSync(sql,rows.join('\n'));
const remote=process.argv.includes('--remote');
const args=['d1','execute','gaming-jobs',remote?'--remote':'--local','--file',sql];if(!remote)args.push('--persist-to',resolve(root,'.wrangler/state'));
const result=spawnSync(process.execPath,[resolve(root,'apps/crawler/node_modules/wrangler/bin/wrangler.js'),...args],{cwd:resolve(root,'apps/crawler'),stdio:'inherit',env:{...process.env,XDG_CONFIG_HOME:resolve(root,'.wrangler/config'),WRANGLER_LOG_PATH:resolve(root,'.wrangler/logs')}});process.exitCode=result.status||0;
