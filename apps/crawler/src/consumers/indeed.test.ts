import { describe, expect, it, vi } from "vitest";

import type { IndeedConsumerRepository } from "./indeed";
import { handleIndeedMessage } from "./indeed";

const PRODUCT_USER_AGENT =
  "StudioDirectBot/1.0 (+https://studio-direct.example/bot; jobs@studio-direct.example)";
const now = () => new Date("2026-09-02T12:00:00.000Z");
const jsonLdHtml = `<!doctype html>
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Senior Unity Engineer",
        "description": "<p>Build remote multiplayer game systems.</p>",
        "datePosted": "2026-08-28",
        "url": "https://jobs.pixelworks.example/senior-unity-engineer",
        "jobLocationType": "TELECOMMUTE",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "Pixel Works"
        }
      }
    </script>
  </head>
</html>`;

function memoryKv(initialLock?: string): KVNamespace {
  const store = new Map<string, string>();
  if (initialLock) store.set("lock:host:www.indeed.com", initialLock);

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

function repository(): IndeedConsumerRepository {
  return {
    findJobByCanonicalKey: vi.fn(async () => null),
    hasSighting: vi.fn(async () => false),
    listListedCareerJobs: vi.fn(async () => []),
    unlistJobs: vi.fn(async () => undefined),
    upsertJob: vi.fn(async (job) => job),
    insertSighting: vi.fn(async () => undefined),
  };
}

describe("handleIndeedMessage", () => {
  it("treats injected empty HTML as a successful empty run", async () => {
    const repo = repository();
    const { db, bindings } = recordingDb();
    const fetchImpl = vi.fn(async () => new Response("", { status: 200 }));

    const result = await handleIndeedMessage(
      { kind: "indeed", query: "unity remote" },
      { DB: db, LOCKS: memoryKv() },
      {
        fetchImpl,
        repo,
        resolveCompany: vi.fn(),
        now,
        randomUUID: () => "run:indeed-empty",
      },
    );

    expect(result).toEqual({ action: "ack" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://www.indeed.com/jobs?q=unity%20remote",
      {
        method: "GET",
        headers: { "User-Agent": PRODUCT_USER_AGENT },
      },
    );
    expect(repo.upsertJob).not.toHaveBeenCalled();
    expect(bindings).toContainEqual([
      "run:indeed-empty",
      "indeed",
      "2026-09-02T12:00:00.000Z",
      "2026-09-02T12:00:00.000Z",
      1,
      '{"query":"unity remote","fetched":0,"parseableDrafts":0,"upserted":0,"droppedStaffing":0}',
    ]);
  });

  it("marks a job as seen on Indeed only for synthetic JSON-LD", async () => {
    const repo = repository();
    const { db, bindings } = recordingDb();
    const resolveCompany = vi.fn(async () => ({
      id: "company:pixel-works",
      tenantId: "tenant:gaming",
    }));

    const result = await handleIndeedMessage(
      { kind: "indeed", query: "unity remote" },
      { DB: db, LOCKS: memoryKv() },
      {
        fetchImpl: async () => new Response(jsonLdHtml, { status: 200 }),
        repo,
        resolveCompany,
        now,
        randomUUID: () => "run:indeed-jsonld",
      },
    );

    expect(result).toEqual({ action: "ack" });
    expect(resolveCompany).toHaveBeenCalledWith("Pixel Works");
    expect(repo.upsertJob).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company:pixel-works",
        title: "Senior Unity Engineer",
        seenOnIndeed: 1,
      }),
    );
    expect(repo.insertSighting).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "indeed",
        sourceUrl: "https://jobs.pixelworks.example/senior-unity-engineer",
      }),
    );
    expect(bindings).toContainEqual([
      "run:indeed-jsonld",
      "indeed",
      "2026-09-02T12:00:00.000Z",
      "2026-09-02T12:00:00.000Z",
      1,
      '{"query":"unity remote","fetched":1,"parseableDrafts":1,"upserted":1,"droppedStaffing":0}',
    ]);
  });

  it("records a failed run and retries using Retry-After for 429 and 403", async () => {
    const repo = repository();
    const { db, bindings } = recordingDb();

    const limited = await handleIndeedMessage(
      { kind: "indeed", query: "unity remote" },
      { DB: db, LOCKS: memoryKv() },
      {
        fetchImpl: async () =>
          new Response("slow down", {
            status: 429,
            headers: { "Retry-After": "30" },
          }),
        repo,
        resolveCompany: vi.fn(),
        now,
        randomUUID: () => "run:indeed-429",
      },
    );

    expect(limited).toEqual({ action: "retry", delaySeconds: 30 });
    expect(bindings).toContainEqual([
      "run:indeed-429",
      "indeed",
      "2026-09-02T12:00:00.000Z",
      "2026-09-02T12:00:00.000Z",
      0,
      '{"status":429,"retryAfterSeconds":30}',
    ]);

    const blocked = await handleIndeedMessage(
      { kind: "indeed", query: "unity remote" },
      { DB: db, LOCKS: memoryKv() },
      {
        fetchImpl: async () => new Response("blocked", { status: 403 }),
        repo,
        resolveCompany: vi.fn(),
        now,
        randomUUID: () => "run:indeed-403",
      },
    );

    expect(blocked).toEqual({ action: "retry" });
    expect(bindings).toContainEqual([
      "run:indeed-403",
      "indeed",
      "2026-09-02T12:00:00.000Z",
      "2026-09-02T12:00:00.000Z",
      0,
      '{"status":403,"retryAfterSeconds":null}',
    ]);
  });

  it("retries without fetching when the Indeed host lock is held", async () => {
    const repo = repository();
    const { db } = recordingDb();
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await handleIndeedMessage(
      { kind: "indeed", query: "unity remote" },
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
