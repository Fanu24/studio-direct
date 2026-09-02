import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getAuthTables } from "better-auth/db";

const sql = readFileSync(
  new URL("../../../../packages/db/migrations/0002_auth.sql", import.meta.url),
  "utf8",
);

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      run(...values: unknown[]): unknown;
    };
  };
};

describe("Better Auth account.issuer vs D1 schema", () => {
  it("requires issuer on account insert and matches the 0002 column", () => {
    const tables = getAuthTables({
      user: {
        modelName: "users",
        fields: {
          emailVerified: "email_verified",
          createdAt: "created_at",
          updatedAt: "updated_at",
        },
      },
      account: {
        fields: {
          accountId: "account_id",
          providerId: "provider_id",
          userId: "user_id",
          accessToken: "access_token",
          refreshToken: "refresh_token",
          idToken: "id_token",
          accessTokenExpiresAt: "access_token_expires_at",
          refreshTokenExpiresAt: "refresh_token_expires_at",
          createdAt: "created_at",
          updatedAt: "updated_at",
        },
      },
    });

    expect(tables.account?.fields.issuer).toMatchObject({
      type: "string",
      required: true,
      fieldName: "issuer",
    });
    expect(sql).toMatch(/CREATE TABLE account[\s\S]*issuer TEXT NOT NULL/);

    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      ${sql}
    `);
    sqlite.exec(
      "INSERT INTO users (id, tenant_id, email, created_at) VALUES ('user-1', 'tenant-1', 'dev@example.com', '2026-09-02T00:00:00.000Z')",
    );

    expect(() =>
      sqlite.prepare(
        `INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at)
         VALUES ('acct-1', 'google-1', 'google', 'user-1', '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z')`,
      ).run(),
    ).toThrow();

    sqlite
      .prepare(
        `INSERT INTO account (id, issuer, account_id, provider_id, user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "acct-1",
        "https://accounts.google.com",
        "google-1",
        "google",
        "user-1",
        "2026-09-02T00:00:00.000Z",
        "2026-09-02T00:00:00.000Z",
      );
  });
});
