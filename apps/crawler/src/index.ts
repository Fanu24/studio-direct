/// <reference path="../worker-configuration.d.ts" />

import { isQueueMessage } from "@gaming/shared";

import { handleCareerMessage } from "./consumers/career";
import { enqueueCronWork } from "./cron";

export default {
  fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, worker: "crawler" });
    }

    return new Response("Not Found", { status: 404 });
  },

  async queue(batch, env) {
    const careerMessages = batch.messages.filter(
      (message) =>
        isQueueMessage(message.body) && message.body.kind === "career",
    );
    if (careerMessages.length === 0) {
      batch.ackAll();
      return;
    }

    for (const message of batch.messages) {
      if (!isQueueMessage(message.body) || message.body.kind !== "career") {
        message.ack();
        continue;
      }

      const result = await handleCareerMessage(message.body, env);
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
