import {
  API_SWEEP_COUNTRIES,
  API_SWEEP_TAGS,
  type QueueMessage,
} from "@gaming/shared";

type CronEnv = Pick<Env, "DB" | "CRAWL_CAREER" | "CRAWL_LINKEDIN" | "CRAWL_INDEED"> & {WEB3_CAREER_API_TOKEN?:string;EMAIL_ENABLED?:string};

async function send(queue: Queue, message: QueueMessage): Promise<void> {
  await queue.send(message);
}

export async function enqueueCronWork(
  env: CronEnv,
): Promise<{ enqueuedApi: number; enqueuedCareer:number }> {
  let enqueuedApi = 0;
  let enqueuedCareer=0;
  // Keyset pagination: D1 result size stays bounded even as the source pool grows.
  let after='';
  for(;;){
    const page=await env.DB.prepare(`SELECT id FROM companies WHERE listed=1 AND id>?
      AND ((ats_type IN ('greenhouse','lever','ashby') AND ats_slug IS NOT NULL AND ats_slug!='')
       OR (ats_type IS NULL AND career_url IS NOT NULL AND career_url!='')) ORDER BY id LIMIT 100`).bind(after).all<{id:string}>();
    // Spread a catalog sweep so shared ATS hosts are not hit by a burst of hundreds of boards.
    if(page.results.length)await env.CRAWL_CAREER.sendBatch(page.results.map((company,index)=>({body:{kind:'career',companyId:company.id},delaySeconds:Math.min((enqueuedCareer+index)*3,3600)})));
    enqueuedCareer+=page.results.length;
    if(page.results.length<100)break;
    after=page.results[page.results.length-1].id;
  }
  if(env.EMAIL_ENABLED==='true'){
    let cursor='';
    for(;;){const alerts=await env.DB.prepare('SELECT id FROM job_alerts WHERE id>? AND enabled=1 AND (last_sent_at IS NULL OR last_sent_at<?) ORDER BY id LIMIT 100').bind(cursor,new Date(Date.now()-86400000).toISOString()).all<{id:string}>();for(const alert of alerts.results)await send(env.CRAWL_CAREER,{kind:'alert',alertId:alert.id});if(alerts.results.length<100)break;cursor=alerts.results[alerts.results.length-1].id;}
  }
  if(!env.WEB3_CAREER_API_TOKEN?.trim())return {enqueuedApi,enqueuedCareer};

  await send(env.CRAWL_CAREER, { kind: "web3_api", remote: true });
  enqueuedApi += 1;

  for (const tag of API_SWEEP_TAGS) {
    await send(env.CRAWL_CAREER, { kind: "web3_api", tag });
    enqueuedApi += 1;
  }

  for (const country of API_SWEEP_COUNTRIES) {
    await send(env.CRAWL_CAREER, { kind: "web3_api", country });
    enqueuedApi += 1;
  }

  return { enqueuedApi,enqueuedCareer };
}
