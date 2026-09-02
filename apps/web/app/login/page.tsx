import type { Metadata } from "next";

import { CheckIcon } from "../_components/icons";
import { GoogleSignInButton, LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Studio Direct with a magic link or with Google to unlock studio apply links, keep a profile, and see your unlock history.",
  alternates: { canonical: "/login" },
};

/* Only things the account actually does. Studios never see a profile unless the
   talent pool is switched on from Settings, and that is off by default. */
const ACCOUNT_PERKS = [
  "5 free unlocks per UTC week",
  "A profile and PDF CV you fill in once",
  "Your unlock history",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const siteKey = process.env.TURNSTILE_SITE_KEY ?? "";

  return (
    <main className="acct-main login">
      <div className="container login__grid">
        <section aria-labelledby="login-title" className="login__brand">
          <span className="kicker">Your account</span>
          <h1 id="login-title">Sign in to Studio Direct</h1>
          <p className="lead">Send a magic link to your email, or continue with Google.</p>
          <p>
            You can send another magic link from this page if the email does not arrive.
          </p>
          <p className="login__perks-label">What an account gives you</p>
          <ul className="login__perks">
            {ACCOUNT_PERKS.map((perk) => (
              <li key={perk}>
                <CheckIcon size={16} />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="panel panel--lg login__card">
          {sent ? (
            <p className="notice notice--accent" role="status">
              Check your email for a sign-in link. You can send another magic link below.
            </p>
          ) : null}
          {error ? (
            <p className="notice notice--danger" role="alert">
              {error}
            </p>
          ) : null}
          <LoginForm siteKey={siteKey}>
            <label htmlFor="login-email">
              <span>Email</span>
              <input
                autoComplete="email"
                id="login-email"
                name="email"
                placeholder="you@example.com"
                required
                type="email"
              />
            </label>
            <button className="button button--block" type="submit">
              Send magic link
            </button>
          </LoginForm>
          <p className="login__or">
            <span>or</span>
          </p>
          <GoogleSignInButton>Continue with Google</GoogleSignInButton>
          <p className="login__fine">
            New here? Your account is created the first time you sign in. We then ask for
            a display name and a target role.
          </p>
        </div>
      </div>
    </main>
  );
}
