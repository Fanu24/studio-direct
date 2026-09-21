// @ts-expect-error Node-only test harness.
import {DatabaseSync} from 'node:sqlite';
// @ts-expect-error Node-only test harness.
import {readFileSync,readdirSync} from 'node:fs';
import {beforeEach,it,expect,vi} from 'vitest';
import {enqueueDiscovery,handleCatalog,handleSourceDiscovery,saveCatalog} from './discovery';

let sql:any,env:Env;
beforeEach(()=>{
 sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 const dir=new URL('../../../packages/db/migrations/',import.meta.url);
 for(const name of readdirSync(dir).filter((n:string)=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(name,dir),'utf8'));
 const db={prepare(query:string){let args:unknown[]=[];return {bind(...values:unknown[]){args=values;return this;},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};},async first(column?:string){const r=sql.prepare(query).get(...args);return (column?r?.[column]:r)??null;},async all(){return {results:sql.prepare(query).all(...args)};}};},async batch(statements:any[]){sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 env={DB:db,CRAWL_CAREER:{send:vi.fn(),sendBatch:vi.fn()},SOURCE_DISCOVERY_ENABLED:'true'} as unknown as Env;
});
const seed={id:'curated:company.com',name:'Company',website:'https://company.com',origin:'curated' as const};
it('claims only one daily discovery run, recovers failed dispatch and renews after 24 hours',async()=>{
 const now=new Date('2026-09-17T00:00:00Z');
 await expect(enqueueDiscovery(env,now)).resolves.toBe(1);await expect(enqueueDiscovery(env,now)).resolves.toBe(0);
 sql.prepare("UPDATE discovery_state SET completed_at=?").run(now.toISOString());
 await expect(enqueueDiscovery(env,new Date('2026-09-17T06:00:00Z'))).resolves.toBe(0);
 vi.mocked(env.CRAWL_CAREER.send).mockRejectedValueOnce(Error('Queue down'));
 await expect(enqueueDiscovery(env,new Date('2026-09-18T00:00:01Z'))).rejects.toThrow('Queue down');
 expect(sql.prepare('SELECT started_at FROM discovery_state').get().started_at).toBeNull();
 await expect(enqueueDiscovery(env,new Date('2026-09-18T00:00:02Z'))).resolves.toBe(1);
});
it('retains previous results unless the official website changes',async()=>{
 await saveCatalog(env.DB,[seed]);sql.exec("UPDATE source_catalog SET checked_at='2026-09-17',status='ats_found'");
 await saveCatalog(env.DB,[seed]);expect(sql.prepare('SELECT status FROM source_catalog').get().status).toBe('ats_found');
 await saveCatalog(env.DB,[{...seed,website:'https://newcompany.com'}]);expect(sql.prepare('SELECT checked_at,status FROM source_catalog').get()).toMatchObject({checked_at:null,status:'pending'});
});
it('deduplicates the same employer across feeds and repeated queue delivery',async()=>{
 const second={...seed,id:'a16z:company.com',origin:'a16z_crypto' as const,name:'Company Labs'};
 await saveCatalog(env.DB,[seed,second]);
 const fetcher=async(url:any)=>new Response(String(url).endsWith('/robots.txt')?'':'<a href="https://jobs.ashbyhq.com/company">Careers</a>');
 await handleSourceDiscovery(seed.id,env,fetcher);await handleSourceDiscovery(second.id,env,fetcher);await handleSourceDiscovery(seed.id,env,fetcher);
 expect(sql.prepare("SELECT COUNT(*) n FROM companies WHERE domain='company.com'").get().n).toBe(1);
 expect(sql.prepare('SELECT COUNT(DISTINCT company_id) n FROM source_catalog').get().n).toBe(1);
 expect(env.CRAWL_CAREER.send).toHaveBeenCalledWith({kind:'career',companyId:expect.any(String)});
});
it('does not activate a third-party portfolio board as the source company',async()=>{
 await saveCatalog(env.DB,[seed]);await handleSourceDiscovery(seed.id,env,async()=>new Response('<a href="https://jobs.ashbyhq.com/other-employer">Careers</a>'));
 expect(sql.prepare('SELECT company_id,status FROM source_catalog').get()).toMatchObject({company_id:null,status:'needs_review'});
 expect(env.CRAWL_CAREER.send).not.toHaveBeenCalled();
});
it('keeps sources usable when an external catalog is unavailable',async()=>{
 await saveCatalog(env.DB,[seed]);sql.exec("INSERT INTO discovery_state(id) VALUES('catalog')");
 await handleCatalog(env,async()=>new Response('',{status:503}));
 expect(sql.prepare('SELECT active FROM source_catalog WHERE id=?').get(seed.id).active).toBe(1);
 expect(sql.prepare('SELECT error FROM discovery_state').get().error).toContain('previous sources retained');
 expect(env.CRAWL_CAREER.sendBatch).toHaveBeenCalled();
});

it('quarantines a previously discovered board after identity changes, retaining independent verification',async()=>{
 const other={...seed,id:'a16z:company.com',origin:'a16z_crypto' as const};
 await saveCatalog(env.DB,[seed,other]);
 const valid=async()=>new Response('<a href="https://jobs.ashbyhq.com/company">Careers</a>');
 const mismatch=async()=>new Response('<a href="https://jobs.ashbyhq.com/other-employer">Careers</a>');
 await handleSourceDiscovery(seed.id,env,valid);await handleSourceDiscovery(other.id,env,valid);
 await saveCatalog(env.DB,[{...seed,website:'https://company-new.com'}]);
 await handleSourceDiscovery(seed.id,env,mismatch);
 expect(sql.prepare('SELECT career_url FROM companies WHERE domain=?').get('company.com').career_url).toBeTruthy();
 await saveCatalog(env.DB,[{...other,website:'https://company-new.com'}]);
 await handleSourceDiscovery(other.id,env,mismatch);
 expect(sql.prepare('SELECT career_url,ats_type,ats_slug FROM companies WHERE domain=?').get('company.com'))
   .toEqual({career_url:null,ats_type:null,ats_slug:null});
});
it('retains a verified career source after a temporary discovery outage',async()=>{
 await saveCatalog(env.DB,[seed]);
 await handleSourceDiscovery(seed.id,env,async()=>new Response('<a href="https://jobs.ashbyhq.com/company">Careers</a>'));
 await handleSourceDiscovery(seed.id,env,async()=>new Response('',{status:503}));
 expect(sql.prepare('SELECT career_url FROM companies WHERE domain=?').get('company.com').career_url).toBe('https://jobs.ashbyhq.com/company');
});
