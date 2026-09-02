/// <reference path="../worker-configuration.d.ts" />

import { isQueueMessage, type QueueMessage } from "@gaming/shared";

import { handleCareerMessage } from "./consumers/career";
import { handleIndeedMessage } from "./consumers/indeed";
import { handleLinkedinMessage } from "./consumers/linkedin";
import { enqueueCronWork } from "./cron";

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
};

const defaultQueueHandlers: QueueHandlers = {
  career: handleCareerMessage,
  linkedin: handleLinkedinMessage,
  indeed: handleIndeedMessage,
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
      ? "career"
      : batch.queue === "crawl-linkedin"
        ? "linkedin"
        : "indeed";
  const hasMatchingMessage = batch.messages.some(
    (message) =>
      isQueueMessage(message.body) && message.body.kind === expectedKind,
  );
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
    if (batch.queue === "crawl-career" && message.body.kind === "career") {
      result = await handlers.career(message.body, env);
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
    const now = new Date().toISOString();
    const stats = await enqueueCronWork(env);

    await env.DB.prepare(
      `INSERT INTO crawl_runs
        (id, source, started_at, finished_at, ok, stats_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        "career_page",
        now,
        now,
        1,
        JSON.stringify(stats),
      )
      .run();
  },
} satisfies ExportedHandler<Env>;
