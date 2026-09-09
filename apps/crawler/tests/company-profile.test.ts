import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

import { D1JobsRepository } from "../src/repo/d1";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    TEST_MIGRATIONS: D1Migration[];
  }
}

const tenantId = "tenant:company-profile";

describe("D1JobsRepository.upsertCompanyProfile", () => {
  beforeAll(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    await env.DB.prepare("INSERT INTO tenants (id, slug, name) VALUES (?, ?, ?)")
      .bind(tenantId, "company-profile", "Company Profile Tests")
      .run();
  });

  it("persists domain and logo_url for a newly discovered company", async () => {
    const repo = new D1JobsRepository(env.DB);

    const { id } = await repo.upsertCompanyProfile({
      tenantId,
      name: "Moonshot Games Studio",
      nameNorm: "moonshot games studio",
      domain: "moonshotgames.example",
      logoUrl: "https://cdn.example/moonshot-logo.png",
      createdAt: "2026-09-08T00:00:00.000Z",
    });

    const row = await env.DB.prepare(
      "SELECT domain, logo_url FROM companies WHERE id = ?",
    )
      .bind(id)
      .first<{ domain: string | null; logo_url: string | null }>();

    expect(row).toEqual({
      domain: "moonshotgames.example",
      logo_url: "https://cdn.example/moonshot-logo.png",
    });
  });

  it("is idempotent: upserting the same company twice does not duplicate the row", async () => {
    const repo = new D1JobsRepository(env.DB);
    const input = {
      tenantId,
      name: "Pixel Forge",
      nameNorm: "pixel forge",
      domain: "pixelforge.example",
      logoUrl: "https://cdn.example/pixel-forge.png",
      createdAt: "2026-09-08T00:00:00.000Z",
    };

    const first = await repo.upsertCompanyProfile(input);
    const second = await repo.upsertCompanyProfile(input);
    expect(second.id).toBe(first.id);

    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM companies WHERE tenant_id = ? AND name_norm = ?",
    )
      .bind(tenantId, "pixel forge")
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it("never overwrites a stored domain/logo_url with null on a later pass", async () => {
    const repo = new D1JobsRepository(env.DB);
    const nameNorm = "scopely";

    await repo.upsertCompanyProfile({
      tenantId,
      name: "Scopely",
      nameNorm,
      domain: "scopely.example",
      logoUrl: "https://cdn.example/scopely.png",
      createdAt: "2026-09-08T00:00:00.000Z",
    });

    // A later ingest pass with no resolvable domain/logo must not blank out
    // the values already stored.
    await repo.upsertCompanyProfile({
      tenantId,
      name: "Scopely",
      nameNorm,
      domain: null,
      logoUrl: null,
      createdAt: "2026-09-09T00:00:00.000Z",
    });

    const row = await env.DB.prepare(
      "SELECT domain, logo_url FROM companies WHERE tenant_id = ? AND name_norm = ?",
    )
      .bind(tenantId, nameNorm)
      .first<{ domain: string | null; logo_url: string | null }>();

    expect(row).toEqual({
      domain: "scopely.example",
      logo_url: "https://cdn.example/scopely.png",
    });
  });

  it("fills in a previously null domain/logo_url once one becomes available", async () => {
    const repo = new D1JobsRepository(env.DB);
    const nameNorm = "epic-games";

    await repo.upsertCompanyProfile({
      tenantId,
      name: "Epic Games",
      nameNorm,
      domain: null,
      logoUrl: null,
      createdAt: "2026-09-08T00:00:00.000Z",
    });

    await repo.upsertCompanyProfile({
      tenantId,
      name: "Epic Games",
      nameNorm,
      domain: "epicgames.example",
      logoUrl: "https://cdn.example/epic.png",
      createdAt: "2026-09-09T00:00:00.000Z",
    });

    const row = await env.DB.prepare(
      "SELECT domain, logo_url FROM companies WHERE tenant_id = ? AND name_norm = ?",
    )
      .bind(tenantId, nameNorm)
      .first<{ domain: string | null; logo_url: string | null }>();

    expect(row).toEqual({
      domain: "epicgames.example",
      logo_url: "https://cdn.example/epic.png",
    });
  });
});
