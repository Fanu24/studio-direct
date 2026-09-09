import {
  API_SWEEP_COUNTRIES,
  API_SWEEP_TAGS,
  type QueueMessage,
} from "@gaming/shared";

type CronEnv = Pick<Env, "DB" | "CRAWL_CAREER" | "CRAWL_LINKEDIN" | "CRAWL_INDEED">;

async function send(queue: Queue, message: QueueMessage): Promise<void> {
  await queue.send(message);
}

export async function enqueueCronWork(
  env: CronEnv,
): Promise<{ enqueuedApi: number }> {
  let enqueuedApi = 0;

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

  return { enqueuedApi };
}
