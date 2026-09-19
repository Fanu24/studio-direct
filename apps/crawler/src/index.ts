/// <reference path="../worker-configuration.d.ts" />

import { reconcileListingPeriods, deliverNotifications, isQueueMessage, type QueueMessage } from "@gaming/shared";

import { handleCareerMessage } from "./consumers/career";
import { handleIndeedMessage } from "./consumers/indeed";
import { handleLinkedinMessage } from "./consumers/linkedin";
import { handleWeb3ApiMessage } from "./consumers/web3-api";
import { enqueueCronWork } from "./cron";
import { rebuildSalaryRollups } from "./pipeline/rollups";
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
  if (
    batch.queue !== "crawl-career" &&
    batch.queue !== "crawl-linkedin" &&
    batch.queue !== "crawl-indeed"
  ) {
    batch.ackAll();
    return;
  }

  const expectedKind =
    batch.queue === "crawl-career"
      ? null
      : batch.queue === "crawl-linkedin"
        ? "linkedin"
        : "indeed";
  const hasMatchingMessage = batch.messages.some((message) => {
    if (!isQueueMessage(message.body)) return false;
    if (batch.queue === "crawl-career") {
      return ['career','web3_api','alert','discover_catalog','discover_source'].includes(message.body.kind);
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
    if(batch.queue==='crawl-career'&&message.body.kind==='discover_catalog'){
      result=await handleCatalog(env);
    } else if(batch.queue==='crawl-career'&&message.body.kind==='discover_source'){
      result=await handleSourceDiscovery(message.body.sourceId,env);
    } else if(batch.queue==='crawl-career'&&message.body.kind==='alert'){
      result=await handleAlert(message.body.alertId,env);
    } else if (batch.queue === "crawl-career" && message.body.kind === "career") {
      result = await handlers.career(message.body, env);
    } else if (batch.queue === "crawl-career" && message.body.kind === "web3_api") {
      result = await handlers.web3Api(message.body, env);
    } else if (
      batch.queue === "crawl-linkedin" &&
      message.body.kind === "linkedin"
    ) {
      result = await handlers.linkedin(message.body, env);
    } else if (
      batch.queue === "crawl-indeed" &&
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
    await deliverNotifications(env);
    if(_controller.cron==="*/5 * * * *")return;
    const now = new Date();
    const nowIso = now.toISOString();
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
