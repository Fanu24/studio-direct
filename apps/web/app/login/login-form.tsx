"use client";

import Script from "next/script";
import { Children, useState, type FormEvent, type ReactNode } from "react";

import { authClient } from "../../lib/auth/client";

type TurnstileApi = { reset?: (widgetId?: string) => void };

export function resetTurnstileWidget(
  turnstile: TurnstileApi | undefined = (globalThis as typeof globalThis & {
    turnstile?: TurnstileApi;
  }).turnstile,
): void {
  turnstile?.reset?.();
}

export async function submitLoginMagicLink({
  callbackURL = "/",
  email,
  newUserCallbackURL = "/onboarding",
  token,
}: {
  callbackURL?: string;
  email: string;
  newUserCallbackURL?: string;
  token: string;
}) {
  try {
    return await authClient.signIn.magicLink({
      email,
      callbackURL,
      newUserCallbackURL,
      fetchOptions: {
        headers: {
          "x-captcha-response": token,
        },
      },
    });
  } finally {
    resetTurnstileWidget();
  }
}

/**
 * Magic-link form. The Turnstile widget renders inside the form, between the
 * fields and the last child (the submit button), so the challenge sits right
 * above the button in both DOM and visual order.
 */
export function LoginForm({
  callbackURL = "/",
  children,
  newUserCallbackURL = "/onboarding",
  siteKey,
}: {
  callbackURL?: string;
  children: ReactNode;
  newUserCallbackURL?: string;
  siteKey: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = Children.toArray(children);
  const submit = items.length > 1 ? items.pop() : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    const token =
      (form.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null)
        ?.value ?? "";

    setError(null);
    const { error: sendError } = await submitLoginMagicLink({
      callbackURL,
      email,
      newUserCallbackURL,
      token,
    });

    if (sendError) {
      setError(
        sendError.message
          ?? "Could not send a magic link. You can send another magic link from this page.",
      );
      return;
    }

    setMessage(
      "Check your email for a sign-in link. You can send another magic link from this page if the email does not arrive.",
    );
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        strategy="afterInteractive"
      />
      {error ? (
        <p className="notice notice--danger" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="notice notice--accent" role="status">
          {message}
        </p>
      ) : null}
      <form className="login__form" onSubmit={onSubmit}>
        {items}
        <div className="cf-turnstile" data-sitekey={siteKey} />
        {submit}
      </form>
    </>
  );
}

export function GoogleSignInButton({
  callbackURL = "/",
  children,
  newUserCallbackURL = "/onboarding",
}: {
  callbackURL?: string;
  children: ReactNode;
  newUserCallbackURL?: string;
}) {
  return (
    <button
      className="button button--secondary button--block"
      type="button"
      onClick={() => {
        void authClient.signIn.social({
          provider: "google",
          callbackURL,
          newUserCallbackURL,
        });
      }}
    >
      {children}
    </button>
  );
}
