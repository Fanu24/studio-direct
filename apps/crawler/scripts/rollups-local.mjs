/**
 * Rebuild salary_rollups in the local D1 databases using the worker's own rollup code.
 *
 * The rollup logic (role stemming, location matching, city/company discovery) lives in
 * src/pipeline/rollups.ts. Reimplementing it in SQL here would drift from production the
 * first time either side changed, so this script runs the real function behind a small
 * adapter that presents node:sqlite through the slice of the D1 interface it uses.
 *
 * Run with:  node --experimental-strip-types scripts/rollups-local.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { rebuildSalaryRollups } from "../src/pipeline/rollups.ts";

const crawlerRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/** The subset of the D1 surface rebuildSalaryRollups touches, over a local SQLite file. */
class SqliteD1 {
  #db;

  constructor(db) {
    this.#db = db;
  }

  prepare(sql) {
    const statement = this.#db.prepare(sql);
    const wrap = (params) => ({
      async all() {
        return { results: statement.all(...params) };
      },
      async run() {
        return statement.run(...params);
      },
      bind: (...next) => wrap(next),
    });
    return wrap([]);
  }
}

function findLocalD1(appRoot) {
  const dir = join(appRoot, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((n) => n.endsWith(".sqlite") && !n.includes("metadata"));
  return file ? join(dir, file) : null;
}

const now = new Date().toISOString();
for (const appRoot of [crawlerRoot, join(crawlerRoot, "..", "web")]) {
  const path = findLocalD1(appRoot);
  if (!path) {
    console.log(`no local D1 under ${appRoot}, skipping`);
    continue;
  }
  const db = new DatabaseSync(path);
  const written = await rebuildSalaryRollups(new SqliteD1(db), now);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM salary_rollups`).get().n;
  const byDimension = db
    .prepare(`SELECT dimension, COUNT(*) AS n FROM salary_rollups GROUP BY dimension ORDER BY dimension`)
    .all();
  db.close();
  console.log(`${path}\n  wrote ${written} rollups, table now holds ${total}`);
  for (const row of byDimension) console.log(`    ${row.dimension}: ${row.n}`);
}
