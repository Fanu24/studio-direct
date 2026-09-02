import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createAuth, type AuthEnv } from "../../../../lib/auth/index";
import {
  exportAccountData,
  type AccountExportDatabase,
} from "../../../../lib/profile/export";

type ExportRouteEnv = AuthEnv & {
  DB: AccountExportDatabase;
};

async function exportEnv(): Promise<ExportRouteEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as ExportRouteEnv;
}

export async function GET(request: Request) {
  const env = await exportEnv();
  const session = await createAuth(env).api.getSession({
    headers: request.headers,
  });
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return Response.json({ code: "unauthorized" }, { status: 401 });
  }

  const payload = await exportAccountData(env.DB, userId);
  return Response.json(payload, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="account-export.json"',
    },
  });
}
