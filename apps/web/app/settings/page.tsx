import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAuth, type AuthEnv } from "../../lib/auth/index";
import {
  loadTalentPoolOptIn,
  type TalentPoolDatabase,
} from "../../lib/profile/talent-pool";

export const dynamic = "force-dynamic";

type SettingsEnv = AuthEnv & {
  DB: TalentPoolDatabase;
};

async function settingsEnv(): Promise<SettingsEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as SettingsEnv;
}

async function sessionUserId(env: SettingsEnv): Promise<string | null> {
  const session = await createAuth(env).api.getSession({
    headers: await headers(),
  });
  return session?.user?.id ?? null;
}

export default async function SettingsPage() {
  const env = await settingsEnv();
  const userId = await sessionUserId(env);

  if (!userId) {
    redirect("/login");
  }

  const optedIn = await loadTalentPoolOptIn(env.DB, userId);

  return (
    <main>
      <h1>Settings</h1>
      <p>
        Applying for jobs does not require this. You can change this anytime.
      </p>
      <form action="/api/account/talent-pool" method="post">
        <label>
          <input
            defaultChecked={optedIn === 1}
            name="talent_pool_opt_in"
            type="checkbox"
            value="1"
          />
          Show my profile to verified studios and recruiters
        </label>
        <button type="submit">Save</button>
      </form>
      <section>
        <h2>Your data</h2>
        <p>
          <a href="/api/account/export">Download my data</a>
        </p>
        <form action="/api/account/delete" method="post">
          <button type="submit">Delete my account</button>
        </form>
      </section>
    </main>
  );
}
