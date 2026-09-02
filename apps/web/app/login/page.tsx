import { GoogleSignInButton, LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const siteKey = process.env.TURNSTILE_SITE_KEY ?? "";

  return (
    <main>
      <h1>Sign in to Studio Direct</h1>
      <p>Send a magic link to your email, or continue with Google.</p>
      <p>
        You can send another magic link from this page if the email does not arrive.
      </p>
      {sent ? (
        <p>
          Check your email for a sign-in link. You can send another magic link below.
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <LoginForm siteKey={siteKey}>
        <label>
          Email
          <input
            autoComplete="email"
            name="email"
            required
            type="email"
          />
        </label>
        <button type="submit">Send magic link</button>
      </LoginForm>
      <GoogleSignInButton>Continue with Google</GoogleSignInButton>
    </main>
  );
}
