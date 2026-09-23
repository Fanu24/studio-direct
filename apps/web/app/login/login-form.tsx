"use client";

import Script from "next/script";
import { Children, cloneElement, useEffect, useRef, useState, type FormEvent, type ReactNode, type ReactElement } from "react";

import { authClient } from "../../lib/auth/client";

type TurnstileApi = { reset?: (widgetId?: string) => void };

export function resetTurnstileWidget(
  turnstile: TurnstileApi | undefined = (globalThis as typeof globalThis & {
    turnstile?: TurnstileApi;
  }).turnstile,
): void {
  // Resetting the widget is best-effort housekeeping, never a reason to fail a
  // sign-in. Turnstile throws from reset() when no widget was ever rendered,
  // and because this runs in submitLoginMagicLink's finally block, that throw
  // replaced the real result of the sign-in: the form showed neither an error
  // nor a confirmation, and the rejection went unhandled. Reachable in
  // production any time the script is blocked or slow to initialise.
  try {
    turnstile?.reset?.();
  } catch {
    // The widget was never mounted, or Turnstile is unavailable. Nothing to reset.
  }
}

export async function submitLoginMagicLink({
  errorCallbackURL,
  callbackURL = "/",
  email,
  newUserCallbackURL = "/onboarding",
  token,
}: {
  errorCallbackURL?: string;
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
      ...(errorCallbackURL ? {errorCallbackURL} : {}),
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
  passwordEnabled=false,
  localTesting=false,
  errorCallbackURL,
  callbackURL = "/",
  children,
  newUserCallbackURL = "/onboarding",
  siteKey,
}: {
  passwordEnabled?:boolean;
  errorCallbackURL?: string;
  callbackURL?: string;
  children: ReactNode;
  newUserCallbackURL?: string;
  siteKey: string;
  localTesting?: boolean;
}) {
  const [pending,setPending]=useState(false);
  const [method,setMethod]=useState<'magic'|'password'|'signup'|'reset'>('magic');
  const [ready,setReady]=useState(false);
  useEffect(()=>setReady(true),[]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token,setToken]=useState(localTesting?'XXXX.DUMMY.TOKEN.XXXX':'');
  const widget=useRef<HTMLDivElement>(null);
  const widgetId=useRef<string|null>(null);
  function renderChallenge(){
    const api=(window as unknown as {turnstile?:{render:(el:HTMLElement,options:Record<string,unknown>)=>string}}).turnstile;
    if(api&&widget.current&&widgetId.current===null&&siteKey)widgetId.current=api.render(widget.current,{sitekey:siteKey,callback:(value:string)=>setToken(value),'expired-callback':()=>setToken(''),'error-callback':()=>setToken('')});
  }
  const items = Children.toArray(children);
  const submit = items.length > 1 ? items.pop() : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(pending)return;
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    if(!token){setError('Please wait for the security check to finish.');return;}

    setError(null);setMessage(null);setPending(true);
    try {
    if(method!=='magic'){
      const fields=new FormData(form),password=String(fields.get('password')??''),fetchOptions={headers:{'x-captcha-response':token}};
      const result=method==='signup'?await authClient.signUp.email({email,password,name:String(fields.get('name')??''),callbackURL:newUserCallbackURL,fetchOptions}):method==='reset'?await authClient.requestPasswordReset({email,redirectTo:'/reset-password',fetchOptions}):await authClient.signIn.email({email,password,callbackURL,fetchOptions});
      if(result.error)setError(result.error.message??'Unable to complete this request.');
      else if(method==='password')window.location.assign(callbackURL);
      else setMessage(method==='signup'?'Check your email to verify your account.':'If this account exists, a password reset link has been sent.');
      resetTurnstileWidget();return;
    }
    const { error: sendError } = await submitLoginMagicLink({
      callbackURL,
      email,
      newUserCallbackURL,
      token,
      errorCallbackURL,
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
    } catch {setError("Could not connect. Please try sending the magic link again.");}
    finally {if(!localTesting)setToken('');setPending(false);}
  }

  return (
    <>
      {!localTesting ? <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={renderChallenge}
        async
        defer
        strategy="afterInteractive"
      /> : <p>Local test mode: your sign-in link appears in the development terminal.</p>}
      {error ? (
        <p className="notice notice--danger" role="alert">
          <strong>Error. </strong>
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="notice notice--accent" role="status">
          <strong>Sent. </strong>
          {message}
        </p>
      ) : null}
      <form className="auth-form" onSubmit={onSubmit}>
        {passwordEnabled?<label>Sign-in method<select value={method} onChange={e=>setMethod(e.target.value as typeof method)}><option value="magic">Email sign-in link</option><option value="password">Email and password</option><option value="signup">Create account with password</option><option value="reset">Reset password</option></select></label>:null}
        {items}
        {method==='signup'?<label>Your name<input name="name" autoComplete="name" required maxLength={100}/></label>:null}
        {method==='password'||method==='signup'?<label>Password<input name="password" type="password" autoComplete={method==='signup'?'new-password':'current-password'} minLength={10} maxLength={128} required/></label>:null}
        <div className="auth-form__turnstile" ref={widget} />
        {method==='magic'?(submit ? cloneElement(submit as ReactElement<{disabled:boolean}>,{disabled:!ready||!token||pending}) : null):<button disabled={!ready||!token||pending}>{method==='password'?'Sign in':method==='signup'?'Create account':'Send reset link'}</button>}
      </form>
    </>
  );
}

export function GoogleSignInButton({
  errorCallbackURL,
  callbackURL = "/",
  children,
  newUserCallbackURL = "/onboarding",
}: {
  errorCallbackURL?: string;
  callbackURL?: string;
  children: ReactNode;
  newUserCallbackURL?: string;
}) {
  const [error,setError]=useState<string|null>(null),[pending,setPending]=useState(false);
  async function signIn() {
    setError(null);setPending(true);
    try {
      const result=await authClient.signIn.social({provider:'google',callbackURL,newUserCallbackURL,...(errorCallbackURL?{errorCallbackURL}:{})});
      if(result.error){setError(result.error.message??'Google sign-in failed. Please try again.');setPending(false);}
    } catch {setError('Could not connect to Google. Please try again.');setPending(false);}
  }
  return <><button className="button button--ghost button--block" type="button" disabled={pending} onClick={()=>void signIn()}>{children}</button>
    {error?<p role="alert" className="notice notice--danger">{error}</p>:null}</>;
}
