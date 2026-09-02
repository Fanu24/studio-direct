import {
  REMOTE_GAMING_QUERIES,
  type QueueMessage,
} from "@gaming/shared";

type CronEnv = Pick<
  Env,
  "DB" | "CRAWL_CAREER" | "CRAWL_LINKEDIN" | "CRAWL_INDEED"
>;

async function send(queue: Queue, message: QueueMessage): Promise<void> {
  await queue.send(message);
}

export async function enqueueCronWork(
  env: CronEnv,
): Promise<{ enqueuedCareer: number }> {
  const { results: companies } = await env.DB.prepare(
    `SELECT id
     FROM companies
     WHERE career_url IS NOT NULL
     ORDER BY id`,
  ).all<{ id: string }>();

  for (const company of companies) {
    await send(env.CRAWL_CAREER, {
      kind: "career",
      companyId: company.id,
    });
  }

  for (const query of REMOTE_GAMING_QUERIES) {
    await send(env.CRAWL_LINKEDIN, { kind: "linkedin", query });
    await send(env.CRAWL_INDEED, { kind: "indeed", query });
  }

  return { enqueuedCareer: companies.length };
}
