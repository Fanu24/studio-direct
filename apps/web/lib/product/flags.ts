import {PRODUCT_FLAGS, effectiveProductFlags, type ProductFlag} from '@gaming/shared';
import type {Database} from '../platform';

export async function loadProductFlags(db: Database, tenantId: string, env: Partial<Record<ProductFlag, string>> = {}) {
  const rows = await db.prepare('SELECT name, enabled FROM feature_flags WHERE tenant_id=?').bind(tenantId)
    .all<{name: string; enabled: number}>();
  const stored = new Map(rows.results.map(row => [row.name, row.enabled === 1]));
  const values = Object.fromEntries(PRODUCT_FLAGS.map(name => [name,
    env[name] === undefined ? stored.get(name) === true : env[name] === 'true',
  ]));
  return effectiveProductFlags(values);
}
