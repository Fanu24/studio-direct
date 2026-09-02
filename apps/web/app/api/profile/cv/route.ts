import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createAuth, type AuthEnv } from "../../../../lib/auth/index";
import { type CompletenessDatabase } from "../../../../lib/profile/completeness";
import { uploadCv, type CvBucket } from "../../../../lib/profile/cv";

type CvRouteEnv = AuthEnv & {
  DB: CompletenessDatabase;
  FILES: CvBucket;
};

async function cvEnv(): Promise<CvRouteEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as CvRouteEnv;
}

export async function POST(request: Request) {
  const env = await cvEnv();
  const session = await createAuth(env).api.getSession({
    headers: request.headers,
  });
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return Response.json({ code: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("cv");
  const result = await uploadCv({
    userId,
    file: file instanceof File ? file : null,
    bucket: env.FILES,
    db: env.DB,
  });

  if (result.status !== 200) {
    return Response.json({ code: result.code }, { status: 400 });
  }

  return Response.redirect(new URL("/profile", request.url), 303);
}
