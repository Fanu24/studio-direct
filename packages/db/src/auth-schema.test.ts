import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../migrations/0002_auth.sql", import.meta.url), "utf8");

describe("0002_auth.sql", () => {
  it("maps spec users onto Better Auth without a second user table", () => {
    expect(sql).toMatch(/spec `users`/i);
    expect(sql).toContain("CREATE TABLE session");
    expect(sql).toContain("CREATE TABLE account");
    expect(sql).toContain("CREATE TABLE verification");
    expect(sql).toContain("ALTER TABLE users");
    expect(sql).toContain("tenant_id");
    expect(sql).not.toContain("CREATE TABLE user ");
    expect(sql).not.toContain("CREATE TABLE users");
  });
});
