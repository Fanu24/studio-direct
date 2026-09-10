import { TENANT_SLUG } from "@gaming/shared";

import type { JobsDatabase } from "./jobs/queries";

export { TENANT_SLUG };

export async function getTenantId(
  db: JobsDatabase,
): Promise<string | null> {
  return db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind(TENANT_SLUG)
    .first<string>("id");
}

export async function requireTenantId(db: JobsDatabase): Promise<string> {
  const id = await getTenantId(db);
  if (!id) throw new Error("Nodework tenant was not found");
  return id;
}
