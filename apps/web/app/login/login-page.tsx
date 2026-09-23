import {getCloudflareContext} from '@opennextjs/cloudflare';


import { CheckIcon } from "../_components/icons";
import Link from "next/link";
import {loginDestinations,type AccountPortal} from "../../lib/auth/portals";
import { GoogleSignInButton, LoginForm } from "./login-form";
import {loadProductFlags} from '../../lib/product/flags';
import {requireTenantId} from '../../lib/tenant';
import type {PlatformEnv} from '../../lib/platform';

/* Only things the account actually does. Companies never see a profile unless the
   talent pool is switched on from Settings, and that is off by default. */
const ACCOUNT_PERKS = [
  "A profile and PDF CV you fill in once",
  "Saved account settings",
  "Saved jobs and job alerts",
];

export async function renderLoginPage(
  {error,intent,next,sent}:{error?:string;intent?:string;next?:string;sent?:string},
  portal:AccountPortal='candidate',
) {
  const employer=portal==='employer';
  const {env}=await getCloudflareContext({async:true});
  const config=env as {TURNSTILE_SITE_KEY?:string;GOOGLE_CLIENT_ID?:string;GOOGLE_CLIENT_SECRET?:string;LOCAL_MAIL?:string;SITE_URL?:string};
  const productEnv=env as unknown as PlatformEnv,flags=await loadProductFlags(productEnv.DB,await requireTenantId(productEnv.DB),productEnv);
  const siteKey = config.TURNSTILE_SITE_KEY ?? "";
  const localTesting=process.env.NODE_ENV==='development'&&config.LOCAL_MAIL==='true'&&siteKey==='1x00000000000000000000AA'&&['http://localhost:3000','http://127.0.0.1:3000'].includes(config.SITE_URL||'');
  const {callbackURL,newUserCallbackURL,errorCallbackURL}=loginDestinations(portal,next);
  const startingFresh = intent === "start";

  return (
    <main className="surface surface--stage auth">
      <div className="container auth-grid">
        <section aria-labelledby="login-title" className="auth-brand">
          <span className="kicker">{employer ? "Employer account" : startingFresh ? "Get started" : "Candidate account"}</span>
          <h1 id="login-title">{employer ? "Employer sign in" : "Sign in to Nodework"}</h1>
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
            {(employer ? ["Publish jobs and manage your listings", "Review applications in your employer dashboard", "Buy job bundles, recruiter access and advertising"] : ACCOUNT_PERKS).map((perk) => (
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
              {"Sign-in could not be completed. Please try again."}
            </p>
          ) : null}
          <LoginForm passwordEnabled={flags.PRODUCT_PROFILES_V2} localTesting={localTesting} callbackURL={callbackURL} newUserCallbackURL={newUserCallbackURL} errorCallbackURL={errorCallbackURL} siteKey={siteKey}>
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
          {config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET ? <GoogleSignInButton callbackURL={callbackURL} newUserCallbackURL={newUserCallbackURL} errorCallbackURL={errorCallbackURL}>
            Continue with Google
          </GoogleSignInButton> : null}
          <p className="auth-fine">
            {employer ? "Sign in to purchase a job, annual plan or company claim. Company access activates after payment; company ownership is verified separately." : "Create your candidate account with an email link, Google or an available password option."}
          </p>
          <p><Link href={employer ? "/login" : "/employer/login"}>{employer ? "Looking for a job? Candidate sign in" : "Hiring? Employer sign in"}</Link></p>
        </div>
      </div>
    </main>
  );
}
