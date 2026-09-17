// @ts-expect-error Node types are not part of the crawler worker tsconfig.
import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type { LinkedinConsumerRepository } from "./linkedin";
import { handleLinkedinMessage } from "./linkedin";

const PRODUCT_USER_AGENT =
  "StudioDirectBot/1.0 (+https://studio-direct.example/bot; jobs@studio-direct.example)";
const now = () => new Date("2026-09-02T12:00:00.000Z");
const emptyHtml = readFileSync(
  new URL("../../test/fixtures/linkedin-empty.html", import.meta.url),
  "utf8",
);
const jsonLdHtml = readFileSync(
  new URL("../../test/fixtures/linkedin-jsonld.html", import.meta.url),
  "utf8",
);

function memoryKv(initialLock?: string): KVNamespace {
  const store = new Map<string, string>();
  if (initialLock) store.set("lock:host:www.linkedin.com", initialLock);

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

function repository(): LinkedinConsumerRepository {
  return {
    findJobByCanonicalKey: vi.fn(async () => null),
    hasSighting: vi.fn(async () => false),
    listListedCareerJobs: vi.fn(async () => []),
    unlistJobs: vi.fn(async () => undefined),
    upsertJob: vi.fn(async (job) => job),
    insertSighting: vi.fn(async () => undefined),
    getLatestLinkedinRun: vi.fn(async () => ({
      ok: true,
      finishedAtIso: "2026-09-02T12:00:00.000Z",
      parseableDrafts: 1,
      okQueryCount: 1,
      dictionarySize: 12,
    })),
    listLinkedinSightings: vi.fn(async () => []),
    listCareerJobsForExclusivity: vi.fn(async () => [
      {
        id: "job:unrelated-animator",
        title: "Senior Animator",
        postedAt: "2026-08-20T10:00:00.000Z",
        companyName: "Other Worlds Studio",
      },
    ]),
    updateExclusivity: vi.fn(async () => undefined),
  };
}

describe("handleLinkedinMessage", () => {
  it("treats an injected empty fixture as a successful empty run", async () => {
    const repo = repository();
    const { db, bindings } = recordingDb();
    const fetchImpl = vi.fn(async () => new Response(emptyHtml, { status: 200 }));

    const result = await handleLinkedinMessage(
      { kind: "linkedin", query: "unity remote" },
      { DB: db, LOCKS: memoryKv() },
      {
        fetchImpl,
        repo,
        resolveCompany: vi.fn(),
        now,
        randomUUID: () => "run:linkedin-empty",
      },
    );

    expect(result).toEqual({ action: "ack" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://www.linkedin.com/jobs/search/?keywords=unity%20remote",
      {
        method: "GET",
        headers: { "User-Agent": PRODUCT_USER_AGENT },
      signal: expect.any(AbortSignal),
      },
    );
    expect(repo.upsertJob).not.toHaveBeenCalled();
    expect(bindings).toContainEqual([
      "run:linkedin-empty",
      "linkedin",
      "2026-09-02T12:00:00.000Z",
      "2026-09-02T12:00:00.000Z",
      1,
      '{"query":"unity remote","fetched":0,"parseableDrafts":0,"upserted":0,"droppedStaffing":0}',
    ]);
  });

  it("ingests a synthetic JSON-LD JobPosting as a LinkedIn sighting", async () => {
    const repo = repository();
    const { db, bindings } = recordingDb();
    const resolveCompany = vi.fn(async () => ({
      id: "company:pixel-works",
      tenantId: "tenant:gaming",
    }));

    const result = await handleLinkedinMessage(
      { kind: "linkedin", query: "unity remote" },
      { DB: db, LOCKS: memoryKv() },
      {
        fetchImpl: async () => new Response(jsonLdHtml, { status: 200 }),
        repo,
        resolveCompany,
        now,
        randomUUID: () => "run:linkedin-jsonld",
      },
    );

    expect(result).toEqual({ action: "ack" });
    expect(resolveCompany).toHaveBeenCalledWith("Pixel Works");
    expect(repo.upsertJob).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company:pixel-works",
        title: "Senior Unity Engineer",
        remote: "remote",
      }),
    );
    expect(repo.insertSighting).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "linkedin",
        sourceUrl: "https://jobs.pixelworks.example/senior-unity-engineer",
      }),
    );
    expect(bindings).toContainEqual([
      "run:linkedin-jsonld",
      "linkedin",
      "2026-09-02T12:00:00.000Z",
      "2026-09-02T12:00:00.000Z",
      1,
      '{"query":"unity remote","fetched":1,"parseableDrafts":1,"upserted":1,"droppedStaffing":0}',
    ]);
    expect(repo.updateExclusivity).toHaveBeenCalledWith(
      "job:unrelated-animator",
      "unknown",
      "2026-09-02T12:00:00.000Z",
    );
    expect(repo.updateExclusivity).not.toHaveBeenCalledWith(
      expect.any(String),
      "hidden_from_linkedin",
      expect.any(String),
    );
  });

  it("does not count parseable drafts from queries that matched zero known companies", async () => {
    const repo = repository();
    const { db, bindings } = recordingDb();

    const result = await handleLinkedinMessage(
      { kind: "linkedin", query: "unity remote" },
      { DB: db, LOCKS: memoryKv() },
      {
        fetchImpl: async () => new Response(jsonLdHtml, { status: 200 }),
        repo,
        resolveCompany: vi.fn(async () => null),
        now,
        randomUUID: () => "run:linkedin-unmatched",
      },
    );

    expect(result).toEqual({ action: "ack" });
    expect(repo.upsertJob).not.toHaveBeenCalled();
    expect(bindings).toContainEqual([
      "run:linkedin-unmatched",
      "linkedin",
      "2026-09-02T12:00:00.000Z",
      "2026-09-02T12:00:00.000Z",
      1,
      '{"query":"unity remote","fetched":1,"parseableDrafts":0,"upserted":0,"droppedStaffing":0}',
    ]);
  });

  it("records a failed run and retries using Retry-After for 429 and 403", async () => {
    const repo = repository();
    const { db, bindings } = recordingDb();

    const limited = await handleLinkedinMessage(
      { kind: "linkedin", query: "unity remote" },
      { DB: db, LOCKS: memoryKv() },
      {
        fetchImpl: async () =>
          new Response("slow down", {
            status: 429,
            headers: { "Retry-After": "45" },
          }),
        repo,
        resolveCompany: vi.fn(),
        now,
        randomUUID: () => "run:linkedin-429",
      },
    );

    expect(limited).toEqual({ action: "retry", delaySeconds: 45 });
    expect(bindings).toContainEqual([
      "run:linkedin-429",
      "linkedin",
      "2026-09-02T12:00:00.000Z",
      "2026-09-02T12:00:00.000Z",
      0,
      '{"status":429,"retryAfterSeconds":45}',
    ]);
    expect(repo.updateExclusivity).not.toHaveBeenCalled();

    const blocked = await handleLinkedinMessage(
      { kind: "linkedin", query: "unity remote" },
      { DB: db, LOCKS: memoryKv() },
      {
        fetchImpl: async () => new Response("blocked", { status: 403 }),
        repo,
        resolveCompany: vi.fn(),
        now,
        randomUUID: () => "run:linkedin-403",
      },
    );

    expect(blocked).toEqual({ action: "retry" });
    expect(bindings).toContainEqual([
      "run:linkedin-403",
      "linkedin",
      "2026-09-02T12:00:00.000Z",
      "2026-09-02T12:00:00.000Z",
      0,
      '{"status":403,"retryAfterSeconds":null}',
    ]);
  });

  it("retries without fetching when the LinkedIn host lock is held", async () => {
    const repo = repository();
    const { db } = recordingDb();
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await handleLinkedinMessage(
      { kind: "linkedin", query: "unity remote" },
      { DB: db, LOCKS: memoryKv("1002000") },
      {
        fetchImpl,
        repo,
        resolveCompany: vi.fn(),
        now: () => new Date(1_001_000),
      },
    );

    expect(result).toEqual({ action: "retry", delaySeconds: 1 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
