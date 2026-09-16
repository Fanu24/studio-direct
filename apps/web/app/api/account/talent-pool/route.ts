import {sameOrigin} from '../../../../lib/platform';
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createAuth, type AuthEnv } from "../../../../lib/auth/index";
import {
  parseTalentPoolOptIn,
  setTalentPoolOptIn,
  type TalentPoolDatabase,
} from "../../../../lib/profile/talent-pool";

type TalentPoolRouteEnv = AuthEnv & {
  DB: TalentPoolDatabase;
};

async function talentPoolEnv(): Promise<TalentPoolRouteEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as TalentPoolRouteEnv;
}

export async function POST(request: Request) {
  if(!sameOrigin(request))return Response.json({code:'invalid_origin'},{status:403});
  const env = await talentPoolEnv();
  const session = await createAuth(env).api.getSession({
    headers: request.headers,
  });
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return Response.json({ code: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  await setTalentPoolOptIn(env.DB, userId, parseTalentPoolOptIn(form));
  return Response.redirect(new URL("/settings", request.url), 303);
}
