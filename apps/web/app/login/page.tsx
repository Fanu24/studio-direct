import {getCloudflareContext} from '@opennextjs/cloudflare';
import type { Metadata } from "next";

import { CheckIcon } from "../_components/icons";
import { onboardingLocation, safeNextPath } from "../../lib/profile/gate";
import { GoogleSignInButton, LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Nodework with a magic link or with Google to keep a profile and saved account details.",
  alternates: { canonical: "/login" },
};

/* Only things the account actually does. Companies never see a profile unless the
   talent pool is switched on from Settings, and that is off by default. */
const ACCOUNT_PERKS = [
  "A profile and PDF CV you fill in once",
  "Saved account settings",
  "Saved jobs, job alerts and employer tools",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; intent?: string; next?: string; sent?: string }>;
}) {
  const { error, intent, next, sent } = await searchParams;
  const {env}=await getCloudflareContext({async:true});
  const config=env as {TURNSTILE_SITE_KEY?:string;GOOGLE_CLIENT_ID?:string;GOOGLE_CLIENT_SECRET?:string;LOCAL_MAIL?:string;SITE_URL?:string};
  const siteKey = config.TURNSTILE_SITE_KEY ?? "";
  const localTesting=process.env.NODE_ENV==='development'&&config.LOCAL_MAIL==='true'&&siteKey==='1x00000000000000000000AA'&&['http://localhost:3000','http://127.0.0.1:3000'].includes(config.SITE_URL||'');
  const callbackURL = safeNextPath(next) ?? "/";
  const newUserCallbackURL = onboardingLocation(next);
  const startingFresh = intent === "start";

  return (
    <main className="surface surface--stage auth">
      <div className="container auth-grid">
        <section aria-labelledby="login-title" className="auth-brand">
          <span className="kicker">{startingFresh ? "Get started" : "Your account"}</span>
          <h1 id="login-title">Sign in to Nodework</h1>
          <p className="lead">
            {startingFresh
              ? "Create your account in one step. Send a magic link or continue with Google, no separate signup form."
              : "Send a magic link to your email to sign in."}
          </p>
          <p>
            You can send another magic link from this page if the email does not arrive.
          </p>
          <p className="auth-perks-label">What an account gives you</p>
          <ul className="auth-perks">
            {ACCOUNT_PERKS.map((perk) => (
              <li key={perk}>
                <CheckIcon size={16} />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="panel panel--lg auth-card">
          {sent ? (
            <p className="notice notice--accent" role="status">
              <strong>Sent. </strong>
              Check your email for a sign-in link. You can send another magic link below.
            </p>
          ) : null}
          {error ? (
            <p className="notice notice--danger" role="alert">
              <strong>Error. </strong>
              {error}
            </p>
          ) : null}
          <LoginForm localTesting={localTesting} callbackURL={callbackURL} newUserCallbackURL={newUserCallbackURL} siteKey={siteKey}>
            <div className="field">
              <label className="field__label" htmlFor="login-email">Email</label>
              <input
                autoComplete="email"
                className="field__input"
                id="login-email"
                name="email"
                placeholder="you@example.com"
                required
                type="email"
              />
            </div>
            <button className="button button--primary button--block" type="submit">
              Send magic link
            </button>
          </LoginForm>
          {config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET ? <p className="auth-or"><span>or</span></p> : null}
          {config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET ? <GoogleSignInButton callbackURL={callbackURL} newUserCallbackURL={newUserCallbackURL}>
            Continue with Google
          </GoogleSignInButton> : null}
          <p className="auth-fine">
            New here? Your account is created the first time you sign in. We then ask for
            a display name and a target role.
          </p>
        </div>
      </div>
    </main>
  );
}
