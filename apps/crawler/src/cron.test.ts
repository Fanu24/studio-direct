import { API_SWEEP_COUNTRIES, API_SWEEP_TAGS, type QueueMessage } from "@gaming/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enqueueCronWork } from "./cron";

function fakeQueue(messages: QueueMessage[]) {
  return {
    async sendBatch(batch:{body:QueueMessage}[]){messages.push(...batch.map(m=>m.body));},
    async send(message: QueueMessage) {
      messages.push(message);
    },
  };
}

describe("enqueueCronWork", () => {
  it('paginates the whole source pool and spreads requests across the sweep',async()=>{
    const rows=Array.from({length:225},(_,i)=>({id:String(i).padStart(4,'0')}));
    const sendBatch=vi.fn(),send=vi.fn();
    const env={DB:{prepare:()=>({bind:(after:string)=>({all:async()=>({results:rows.filter(r=>r.id>after).slice(0,100)})})})},CRAWL_CAREER:{sendBatch,send}};
    expect(await enqueueCronWork(env as unknown as Env)).toEqual({enqueuedCareer:225,enqueuedApi:0});
    expect(sendBatch).toHaveBeenCalledTimes(3);
    const messages=sendBatch.mock.calls.flatMap(c=>c[0]);
    expect(new Set(messages.map(m=>m.body.companyId)).size).toBe(225);
    expect(messages.at(-1).delaySeconds).toBe(672);
    expect(send).not.toHaveBeenCalled();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("enqueues web3 API sweep messages without LinkedIn or Indeed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const careerMessages: QueueMessage[] = [];
    const env = {
      DB: { prepare: vi.fn(()=>({bind:()=>({all:async()=>({results:[]})})})) },
      WEB3_CAREER_API_TOKEN:'test',
      CRAWL_CAREER: fakeQueue(careerMessages),
      CRAWL_LINKEDIN: fakeQueue([]),
      CRAWL_INDEED: fakeQueue([]),
    };

    const stats = await enqueueCronWork(env as unknown as Env);

    expect(careerMessages[0]).toEqual({ kind: "web3_api", remote: true });
    expect(careerMessages).toContainEqual({ kind: "web3_api", tag: "solidity" });
    expect(careerMessages).toContainEqual({
      kind: "web3_api",
      country: API_SWEEP_COUNTRIES[0],
    });
    expect(stats.enqueuedApi).toBe(
      1 + API_SWEEP_TAGS.length + API_SWEEP_COUNTRIES.length,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
