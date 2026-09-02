import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createAuth, type AuthEnv } from "../../../../lib/auth/index";
import {
  deleteAccount,
  type AccountDeleteDatabase,
  type AccountFiles,
} from "../../../../lib/profile/delete-account";

type DeleteRouteEnv = AuthEnv & {
  DB: AccountDeleteDatabase;
  FILES: AccountFiles;
};

async function deleteEnv(): Promise<DeleteRouteEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as DeleteRouteEnv;
}

export async function POST(request: Request) {
  const env = await deleteEnv();
  const session = await createAuth(env).api.getSession({
    headers: request.headers,
  });
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return Response.json({ code: "unauthorized" }, { status: 401 });
  }

  await deleteAccount({
    userId,
    db: env.DB,
    files: env.FILES,
  });

  return Response.redirect(new URL("/", request.url), 303);
}
