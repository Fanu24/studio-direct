"use client";

import Script from "next/script";
import { useState, type FormEvent, type ReactNode } from "react";

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
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  try {
    return await authClient.signIn.magicLink({
      email,
      callbackURL: "/",
      newUserCallbackURL: "/onboarding",
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

export function LoginForm({
  children,
  siteKey,
}: {
  children: ReactNode;
  siteKey: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    const token =
      (form.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null)
        ?.value ?? "";

    setError(null);
    const { error: sendError } = await submitLoginMagicLink({ email, token });

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
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      <form onSubmit={onSubmit}>
        {children}
        <div className="cf-turnstile" data-sitekey={siteKey} />
      </form>
    </>
  );
}

export function GoogleSignInButton({ children }: { children: ReactNode }) {
  return (
    <button
      className="secondary"
      type="button"
      onClick={() => {
        void authClient.signIn.social({
          provider: "google",
          callbackURL: "/",
          newUserCallbackURL: "/onboarding",
        });
      }}
    >
      {children}
    </button>
  );
}
