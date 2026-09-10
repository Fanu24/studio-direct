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
  "Employer posting later, when billing is live",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; intent?: string; next?: string; sent?: string }>;
}) {
  const { error, intent, next, sent } = await searchParams;
  const siteKey = process.env.TURNSTILE_SITE_KEY ?? "";
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
              : "Send a magic link to your email, or continue with Google."}
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
          <LoginForm callbackURL={callbackURL} newUserCallbackURL={newUserCallbackURL} siteKey={siteKey}>
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
          <p className="auth-or">
            <span>or</span>
          </p>
          <GoogleSignInButton callbackURL={callbackURL} newUserCallbackURL={newUserCallbackURL}>
            Continue with Google
          </GoogleSignInButton>
          <p className="auth-fine">
            New here? Your account is created the first time you sign in. We then ask for
            a display name and a target role.
          </p>
        </div>
      </div>
    </main>
  );
}
