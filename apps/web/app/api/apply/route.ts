import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import {
  parseApplyInput,
  safeNextPath,
  submitJobApplication,
  type ApplyDatabase,
} from "../../../lib/jobs/apply";
import type { JobsDatabase } from "../../../lib/jobs/queries";
import { requireTenantId } from "../../../lib/tenant";

type ApplyRouteDatabase = JobsDatabase & ApplyDatabase;

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "");
}

export async function POST(request: Request) {
  const form = await request.formData();
  const next = safeNextPath(field(form, "next"));
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: ApplyRouteDatabase }).DB;
  const tenantId = await requireTenantId(db);

  const result = await submitJobApplication(
    db,
    parseApplyInput({
      tenantId,
      jobId: field(form, "jobId"),
      name: field(form, "name"),
      email: field(form, "email"),
      profileUrl: field(form, "profileUrl"),
      note: field(form, "note"),
      honeypot: field(form, "company_website"),
    }),
  );

  if (!result.ok) {
    return NextResponse.redirect(new URL(`${next}?error=1`, request.url), 303);
  }
  return NextResponse.redirect(new URL(`${next}?sent=1`, request.url), 303);
}
