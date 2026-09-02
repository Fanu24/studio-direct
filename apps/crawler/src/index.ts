/// <reference path="../worker-configuration.d.ts" />

import { enqueueCronWork } from "./cron";

export default {
  fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, worker: "crawler" });
    }

    return new Response("Not Found", { status: 404 });
  },

  queue(batch) {
    batch.ackAll();
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
