/// <reference path="../worker-configuration.d.ts" />

import { reconcileListingPeriods, deliverNotifications, queueProductReminders, isQueueMessage, type QueueMessage } from "@gaming/shared";

import { handleCareerMessage } from "./consumers/career";
import { handleIndeedMessage } from "./consumers/indeed";
import { handleLinkedinMessage } from "./consumers/linkedin";
import { handleWeb3ApiMessage } from "./consumers/web3-api";
import { enqueueCronWork } from "./cron";
import { rebuildSalaryRollups } from "./pipeline/rollups";
import {refreshFxRates} from '@gaming/shared';
import {handleAlert} from './consumers/alerts';
import {enqueueDiscovery,handleCatalog,handleSourceDiscovery} from './discovery';

type QueueHandlerResult =
  | { action: "ack" }
  | { action: "retry"; delaySeconds?: number };

export type QueueHandlers = {
  career: (
    message: Extract<QueueMessage, { kind: "career" }>,
    env: Env,
  ) => Promise<QueueHandlerResult>;
  linkedin: (
    message: Extract<QueueMessage, { kind: "linkedin" }>,
    env: Env,
  ) => Promise<QueueHandlerResult>;
  indeed: (
    message: Extract<QueueMessage, { kind: "indeed" }>,
    env: Env,
  ) => Promise<QueueHandlerResult>;
  web3Api: (
    message: Extract<QueueMessage, { kind: "web3_api" }>,
    env: Env,
  ) => Promise<QueueHandlerResult>;
};

const defaultQueueHandlers: QueueHandlers = {
  career: handleCareerMessage,
  linkedin: handleLinkedinMessage,
  indeed: handleIndeedMessage,
  web3Api: handleWeb3ApiMessage,
};

export async function routeQueueBatch(
  batch: MessageBatch<unknown>,
  env: Env,
  handlers: QueueHandlers = defaultQueueHandlers,
): Promise<void> {
  const prefix=env.QUEUE_PREFIX||'crawl';
  const careerQueue=prefix+'-career',linkedinQueue=prefix+'-linkedin',indeedQueue=prefix+'-indeed';
  if (
    batch.queue !== careerQueue &&
    batch.queue !== linkedinQueue &&
    batch.queue !== indeedQueue
  ) {
    batch.ackAll();
    return;
  }

  const expectedKind =
    batch.queue === careerQueue
      ? null
      : batch.queue === linkedinQueue
        ? "linkedin"
        : "indeed";
  const hasMatchingMessage = batch.messages.some((message) => {
    if (!isQueueMessage(message.body)) return false;
    if (batch.queue === careerQueue) {
      return ['product','career','web3_api','alert','discover_catalog','discover_source'].includes(message.body.kind);
    }
    return message.body.kind === expectedKind;
  });
  if (!hasMatchingMessage) {
    batch.ackAll();
    return;
  }

  for (const message of batch.messages) {
    if (!isQueueMessage(message.body)) {
      message.ack();
      continue;
    }

    let result: QueueHandlerResult;
    if(batch.queue===careerQueue&&message.body.kind==='product'){
      if(!env.PRODUCT_WEB||!env.PRODUCT_INTERNAL_SECRET){result={action:'retry',delaySeconds:3600};}
      else {try{const response=await env.PRODUCT_WEB.fetch('https://internal/api/internal/product/run',{method:'POST',headers:{Authorization:'Bearer '+env.PRODUCT_INTERNAL_SECRET,'Content-Type':'application/json'},body:JSON.stringify({kind:message.body.task,id:message.body.id})});result=response.ok?{action:'ack'}:{action:'retry',delaySeconds:300};}catch{result={action:'retry',delaySeconds:300};}}
    } else if(batch.queue===careerQueue&&message.body.kind==='discover_catalog'){
      result=await handleCatalog(env);
    } else if(batch.queue===careerQueue&&message.body.kind==='discover_source'){
      result=await handleSourceDiscovery(message.body.sourceId,env);
    } else if(batch.queue===careerQueue&&message.body.kind==='alert'){
      result=await handleAlert(message.body.alertId,env);
    } else if (batch.queue === careerQueue && message.body.kind === "career") {
      result = await handlers.career(message.body, env);
    } else if (batch.queue === careerQueue && message.body.kind === "web3_api") {
      result = await handlers.web3Api(message.body, env);
    } else if (
      batch.queue === linkedinQueue &&
      message.body.kind === "linkedin"
    ) {
      result = await handlers.linkedin(message.body, env);
    } else if (
      batch.queue === indeedQueue &&
      message.body.kind === "indeed"
    ) {
      result = await handlers.indeed(message.body, env);
    } else {
      message.ack();
      continue;
    }

    if (result.action === "ack") {
      message.ack();
    } else {
      message.retry(
        result.delaySeconds === undefined
          ? undefined
          : { delaySeconds: result.delaySeconds },
      );
    }
  }
}

export default {
  fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, worker: "crawler" });
    }

    return new Response("Not Found", { status: 404 });
  },

  async queue(batch, env) {
    await routeQueueBatch(batch, env);
  },

  async scheduled(_controller, env) {
    await reconcileListingPeriods(env.DB);
    await queueProductReminders(env.DB);
    await deliverNotifications(env);
    if(env.PRODUCT_WEB&&env.PRODUCT_INTERNAL_SECRET){
      await env.CRAWL_CAREER.send({kind:'product',task:'tick'});
      if(_controller.cron!=="*/5 * * * *"){
        await env.CRAWL_CAREER.send({kind:'product',task:'salary'});
        const integrations=await env.DB.prepare("SELECT i.id FROM company_ats_integrations i JOIN company_plans p ON p.company_id=i.company_id WHERE i.enabled=1 AND p.tier='platinum' AND p.status IN ('active','trialing') AND julianday(p.renews_at)>julianday('now') AND (i.last_success_at IS NULL OR julianday(i.last_success_at)<julianday('now','-1 day')) ORDER BY i.last_success_at LIMIT 500").all<{id:string}>();
        for(const i of integrations.results)await env.CRAWL_CAREER.send({kind:'product',task:'ats',id:i.id});
        const shortlists=await env.DB.prepare("SELECT j.id FROM jobs j JOIN company_plans p ON p.company_id=j.company_id WHERE j.listed=1 AND j.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND p.tier IN ('scale','platinum') AND p.status='active' AND p.renews_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND NOT EXISTS(SELECT 1 FROM product_daily_runs r WHERE r.kind='shortlist:'||j.id AND r.date=date('now')) LIMIT 500").all<{id:string}>();for(const j of shortlists.results)await env.CRAWL_CAREER.send({kind:'product',task:'shortlist',id:j.id});
      }
    }
    if(_controller.cron==="*/5 * * * *")return;
    const now = new Date();
    const nowIso = now.toISOString();
    try{await refreshFxRates(env.DB);}catch(error){console.error('Daily FX refresh failed',error);}
    const stats = await enqueueCronWork(env);
    await enqueueDiscovery(env,now);

    await env.DB.prepare(
      `INSERT INTO crawl_runs
        (id, source, started_at, finished_at, ok, stats_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        "scheduler",
        nowIso,
        nowIso,
        1,
        JSON.stringify(stats),
      )
      .run();

    try {
      // Queue dispatch is not proof of a successful sweep. Never expire imported jobs here.
      await env.DB.prepare(`UPDATE jobs SET listed=0,updated_at=? WHERE id IN
        (SELECT job_id FROM employer_listings WHERE expires_at<=? OR closed_at IS NOT NULL) AND listed=1`)
        .bind(nowIso,nowIso).run();
      await rebuildSalaryRollups(env.DB, nowIso);
    } catch (error) {
      console.error("Salary rollup or stale unlist failed", error);
    }
  },
} satisfies ExportedHandler<Env>;
