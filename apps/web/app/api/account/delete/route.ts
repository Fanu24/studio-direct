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

/**
 * The phrase the account holder has to type to confirm. Checked on the server,
 * not only by the form: until this existed, a single click on the settings page
 * destroyed the account with no confirmation of any kind, which QA verified by
 * hand on a disposable account. The browser's own `required` and `pattern`
 * attributes stop the stray click; this stops everything else.
 */
// Not exported: a Next route module may only export the HTTP handlers and a
// fixed set of config keys, and anything else fails the generated type check.
const DELETE_CONFIRMATION = "DELETE";

async function confirmationPhrase(request: Request): Promise<string | null> {
  try {
    const form = await request.formData();
    const value = form.get("confirm");
    return typeof value === "string" ? value.trim() : null;
  } catch {
    // Not a form submission. Treat it as unconfirmed rather than guessing.
    return null;
  }
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

  if ((await confirmationPhrase(request)) !== DELETE_CONFIRMATION) {
    return Response.json({ code: "confirmation_required" }, { status: 400 });
  }

  await deleteAccount({
    userId,
    db: env.DB,
    files: env.FILES,
  });

  return Response.redirect(new URL("/", request.url), 303);
}
