import Link from 'next/link';
import { TENANT_NAME } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountShell } from "../_components/account-shell";
import { createAuth, type AuthEnv } from "../../lib/auth/index";
import {
  loadTalentPoolOptIn,
  type TalentPoolDatabase,
} from "../../lib/profile/talent-pool";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
  description:
    `${TENANT_NAME} account settings: profile visibility to verified companies, data export, and account deletion.`,
  robots: { index: false, follow: false },
  alternates: { canonical: "/settings" },
};

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
    redirect("/login?next=/settings");
  }

  const optedIn = await loadTalentPoolOptIn(env.DB, userId);

  return (
    <AccountShell
      active="settings"
      lead="Who can see your profile, your data, and what is coming next."
      title="Settings"
    >
      <section aria-labelledby="visibility" className="panel acct-panel">
        <div className="acct-panel__head">
          <h2 id="visibility">Profile visibility</h2>
          <span className={optedIn === 1 ? "chip chip--on" : "chip"}>
            {optedIn === 1 ? "On" : "Off"}
          </span>
        </div>
        <p>
          Off by default. Applying for jobs does not require this. You can change it
          anytime.
        </p>
        <form action="/api/account/talent-pool" className="acct-form" method="post">
          <label className="check">
            <input
              defaultChecked={optedIn === 1}
              name="talent_pool_opt_in"
              type="checkbox"
              value="1"
            />
            Show my profile to verified companies and recruiters
          </label>
          <div className="acct-actions">
            <button className="button" type="submit">
              Save
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="your-data" className="panel acct-panel">
        <div className="acct-panel__head">
          <h2 id="your-data">Your data</h2>
        </div>
        <p>Download everything we store about you as a JSON file.</p>
        <div className="acct-actions">
          <a className="button button--secondary" href="/api/account/export">
            Download my data
          </a>
        </div>
        <div className="acct-danger">
          <p>
            Deleting your account removes your profile, CV and unlock history. This
            cannot be undone.
          </p>
          <form action="/api/account/delete" method="post">
            <div className="field">
              <label className="field__label" htmlFor="delete-confirm">
                Type DELETE to confirm
              </label>
              <input
                autoComplete="off"
                className="field__input"
                id="delete-confirm"
                name="confirm"
                pattern="DELETE"
                required
                title="Type DELETE in capital letters to confirm."
                type="text"
              />
              <p className="field__hint">
                We ask for this because deleting cannot be undone. The server checks
                it too, so a stray click cannot remove your account.
              </p>
            </div>
            <button className="button button--danger" type="submit">
              Delete my account
            </button>
          </form>
        </div>
      </section>

      <section className="panel"><h2>Job alerts</h2><p>Choose a skill, search term or remote preference for new job emails.</p><Link href="/alerts">Manage job alerts</Link></section>
    </AccountShell>
  );
}
