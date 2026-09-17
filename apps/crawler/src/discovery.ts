import {defiLlamaSeeds,cryptoPortfolioSeeds,discoverCompany,CURATED_WEB3_COMPANIES,normalizeCompanyName,type SourceSeed} from '@gaming/shared';

export async function enqueueDiscovery(env:Env,now=new Date()) {
  if(env.SOURCE_DISCOVERY_ENABLED!=='true')return 0;
  const at=now.toISOString(),yesterday=new Date(now.getTime()-86400000).toISOString(),stale=new Date(now.getTime()-3600000).toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO discovery_state(id) VALUES('catalog')").run();
  const claim=await env.DB.prepare(`UPDATE discovery_state SET started_at=?,error=NULL WHERE id='catalog'
    AND (completed_at IS NULL OR completed_at<?) AND (started_at IS NULL OR started_at<?)`).bind(at,yesterday,stale).run();
  if(claim.meta.changes){
    try {await env.CRAWL_CAREER.send({kind:'discover_catalog'});}
    catch(error){await env.DB.prepare("UPDATE discovery_state SET started_at=NULL WHERE id='catalog'").run();throw error;}
    return 1;
  }
  return 0;
}

export async function saveCatalog(db:D1Database,seeds:SourceSeed[],now=new Date()) {
  const at=now.toISOString();
  for(let i=0;i<seeds.length;i+=50)await db.batch(seeds.slice(i,i+50).map(seed=>
    db.prepare(`INSERT INTO source_catalog(id,origin,name,website,market_rank,career_url,updated_at)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,market_rank=excluded.market_rank,
      checked_at=CASE WHEN website!=excluded.website THEN NULL ELSE checked_at END,
      status=CASE WHEN website!=excluded.website THEN 'pending' ELSE status END,
      career_url=CASE WHEN website!=excluded.website THEN excluded.career_url ELSE COALESCE(excluded.career_url,career_url) END,
      ats_type=CASE WHEN website!=excluded.website THEN NULL ELSE ats_type END,
      ats_slug=CASE WHEN website!=excluded.website THEN NULL ELSE ats_slug END,
      website=excluded.website,active=1,updated_at=excluded.updated_at`)
      .bind(seed.id,seed.origin,seed.name,seed.website,seed.rank??null,seed.career_url??null,at)));
  // Only mark a rank as absent after a complete 500-asset snapshot has been persisted.
  if(seeds.filter(s=>s.origin==='coinmarketcap').length===500){
    await db.prepare("UPDATE source_catalog SET active=0 WHERE origin='coinmarketcap' AND updated_at!=?").bind(at).run();
  }
}

export async function handleCatalog(env:Env,fetcher:typeof fetch=fetch) {
  try {
    const feeds=await Promise.allSettled([defiLlamaSeeds({limit:1000,fetcher}),cryptoPortfolioSeeds(fetcher)]);
    const seeds=[...CURATED_WEB3_COMPANIES,...feeds.flatMap(feed=>feed.status==='fulfilled'?feed.value:[])];
    const unavailable=feeds.flatMap((feed,i)=>feed.status==='rejected'?[['DefiLlama','a16z crypto'][i]]:[]);
    await saveCatalog(env.DB,seeds);
    let cursor='';
    const due=new Date(Date.now()-86400000).toISOString();
    for(;;){
      const rows=await env.DB.prepare("SELECT id FROM source_catalog WHERE active=1 AND id>? AND (checked_at IS NULL OR checked_at<?) ORDER BY id LIMIT 100").bind(cursor,due).all<{id:string}>();
      if(rows.results.length)await env.CRAWL_CAREER.sendBatch(rows.results.map(row=>({body:{kind:'discover_source',sourceId:row.id}})));
      if(rows.results.length<100)break;cursor=rows.results.at(-1)!.id;
    }
    await env.DB.prepare("UPDATE discovery_state SET completed_at=?,error=? WHERE id='catalog'").bind(new Date().toISOString(),unavailable.length?'Feed unavailable; previous sources retained: '+unavailable.join(', '):null).run();
    return {action:'ack'} as const;
  }catch(error){
    // Never include provider credentials or full authenticated URLs in diagnostics.
    await env.DB.prepare("UPDATE discovery_state SET error=? WHERE id='catalog'").bind(error instanceof Error?error.message.slice(0,240):'Catalog refresh failed').run();
    throw error;
  }
}

export async function handleSourceDiscovery(sourceId:string,env:Env,fetcher:typeof fetch=fetch) {
  const row=await env.DB.prepare("SELECT * FROM source_catalog WHERE id=? AND active=1").bind(sourceId).first<SourceSeed&{market_rank:number|null}>();
  if(!row)return {action:'ack'} as const;
  const result=await discoverCompany({...row,rank:row.market_rank??undefined},fetcher);
  let companyId:string|null=null;
  if((result.status==='ats_found'||result.status==='jsonld_found')&&result.career_url){
    const tenant=await env.DB.prepare("SELECT id FROM tenants WHERE slug='nodework'").first<string>('id');
    if(!tenant)throw new Error('Web3 tenant is not configured');
    const domain=new URL(row.website).hostname.replace(/^www\./,''),norm=normalizeCompanyName(row.name);
    // A single SQL statement guards identity across concurrent queue deliveries and catalog feeds.
    const identity="tenant_id=? AND (REPLACE(domain,'www.','')=? OR name_norm=? OR (ats_type=? AND ats_slug=?))";
    const identityValues=[tenant,domain,norm,result.ats_type??null,result.ats_slug??null];
    await env.DB.prepare(`INSERT INTO companies(id,tenant_id,name,name_norm,domain,career_url,ats_type,ats_slug,created_at)
      SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM companies WHERE ${identity})`)
      .bind('discovered:'+crypto.randomUUID(),tenant,row.name,norm,domain,result.career_url,result.ats_type??null,result.ats_slug??null,new Date().toISOString(),...identityValues).run();
    companyId=await env.DB.prepare(`SELECT id FROM companies WHERE ${identity} ORDER BY id LIMIT 1`).bind(...identityValues).first<string>('id');
    if(!companyId)throw new Error('Unable to persist discovered company');
    await env.DB.prepare('UPDATE companies SET career_url=?,ats_type=?,ats_slug=? WHERE id=?')
      .bind(result.career_url,result.ats_type??null,result.ats_slug??null,companyId).run();
  }
  await env.DB.prepare(`UPDATE source_catalog SET career_url=?,ats_type=?,ats_slug=?,status=?,company_id=COALESCE(?,company_id),
    checked_at=?,error=? WHERE id=?`).bind(result.career_url??null,result.ats_type??null,result.ats_slug??null,result.status,companyId,result.checked_at,result.error??null,row.id).run();
  if(companyId)await env.CRAWL_CAREER.send({kind:'career',companyId});
  return {action:'ack'} as const;
}
