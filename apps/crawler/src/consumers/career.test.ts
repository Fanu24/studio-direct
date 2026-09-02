import greenhouseBoard from "../../test/fixtures/greenhouse-board.json";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CareerConsumerRepository } from "../repo/d1";
import { handleCareerMessage } from "./career";

const company = {
  id: "company:pixelworks",
  tenantId: "tenant:gaming",
  name: "Pixelworks",
  ats_type: "greenhouse",
  ats_slug: "pixelworks",
  career_url: "https://www.pixelworks.example/careers",
};

function memoryKv(initialLock?: string): KVNamespace {
  const store = new Map<string, string>();
  if (initialLock) store.set("lock:host:boards-api.greenhouse.io", initialLock);

  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  } as unknown as KVNamespace;
}

function recordingDb() {
  const bindings: unknown[][] = [];
  return {
    bindings,
    db: {
      prepare: vi.fn(() => ({
        bind: (...values: unknown[]) => ({
          run: async () => {
            bindings.push(values);
          },
        }),
      })),
    } as unknown as D1Database,
  };
}

function repository(): CareerConsumerRepository {
  const jobs = new Map<string, Awaited<ReturnType<CareerConsumerRepository["upsertJob"]>>>();

  return {
    getById: vi.fn(async () => company),
    findJobByCanonicalKey: vi.fn(async () => null),
    hasSighting: vi.fn(async () => false),
    listListedCareerJobs: vi.fn(async () => []),
    unlistJobs: vi.fn(async () => undefined),
    upsertJob: vi.fn(async (job) => {
      jobs.set(job.id, job);
      return job;
    }),
    insertSighting: vi.fn(async () => undefined),
    listCareerRuns: vi.fn(async () => []),
    getJobsByIds: vi.fn(async (jobIds: readonly string[]) =>
      jobIds.flatMap((id) => {
        const job = jobs.get(id);
        return job ? [job] : [];
      }),
    ),
    getLatestLinkedinRun: vi.fn(async () => ({
      ok: false,
      finishedAtIso: "2026-09-02T11:59:00.000Z",
      parseableDrafts: 0,
    })),
    listLinkedinSightings: vi.fn(async () => []),
    updateExclusivity: vi.fn(async () => undefined),
  };
}

describe("handleCareerMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ingests a Greenhouse fixture and records career success despite failed LinkedIn", async () => {
    const repo = repository();
    const { db, bindings } = recordingDb();
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(greenhouseBoard), { status: 200 }),
    );

    const result = await handleCareerMessage(
      { kind: "career", companyId: company.id },
      { DB: db, LOCKS: memoryKv() },
      {
        fetchImpl,
        repo,
        now: () => new Date("2026-09-02T12:00:00.000Z"),
        randomUUID: () => `id-${Math.random()}`,
      },
    );

    expect(result).toEqual({ action: "ack" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(repo.upsertJob).toHaveBeenCalledTimes(2);
    expect(repo.updateExclusivity).toHaveBeenCalledTimes(2);
    expect(repo.updateExclusivity).toHaveBeenCalledWith(
      expect.any(String),
      "unknown",
      "2026-09-02T12:00:00.000Z",
    );
    expect(bindings).toContainEqual([
      expect.any(String),
      "career_page",
      "2026-09-02T12:00:00.000Z",
      "2026-09-02T12:00:00.000Z",
      1,
      expect.stringContaining('"companyId":"company:pixelworks"'),
    ]);
  });

  it("retries without fetching when the ATS host lock is held", async () => {
    const repo = repository();
    const { db } = recordingDb();
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await handleCareerMessage(
      { kind: "career", companyId: company.id },
      {
        DB: db,
        LOCKS: memoryKv("1002000"),
      },
      {
        fetchImpl,
        repo,
        now: () => new Date(1_001_000),
      },
    );

    expect(result).toEqual({ action: "retry", delaySeconds: 1 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("records a failed run and retries using Retry-After when rate limited", async () => {
    const repo = repository();
    const { db, bindings } = recordingDb();
    const fetchImpl = vi.fn(async () =>
      new Response("", {
        status: 429,
        headers: { "Retry-After": "45" },
      }),
    );

    const result = await handleCareerMessage(
      { kind: "career", companyId: company.id },
      { DB: db, LOCKS: memoryKv() },
      {
        fetchImpl,
        repo,
        now: () => new Date("2026-09-02T12:00:00.000Z"),
        randomUUID: () => "run:rate-limited",
      },
    );

    expect(result).toEqual({ action: "retry", delaySeconds: 45 });
    expect(bindings).toContainEqual([
      "run:rate-limited",
      "career_page",
      "2026-09-02T12:00:00.000Z",
      "2026-09-02T12:00:00.000Z",
      0,
      '{"status":429,"retryAfterSeconds":45}',
    ]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
