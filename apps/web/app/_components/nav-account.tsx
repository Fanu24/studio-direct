"use client";

import Link from "next/link";

import { authClient } from "../../lib/auth/client";

/**
 * Account controls. `bar` sits in the header next to the primary call to action,
 * so it stays quiet; `menu` stacks full-width inside the mobile sheet.
 */
export function NavAccount({ variant = "bar" }: { variant?: "bar" | "menu" }) {
  const { data: session } = authClient.useSession();
  const menu = variant === "menu";
  const block = menu ? " button--block" : "";
  const className = menu ? "nav-account nav-account--menu" : "nav-account";

  if (session?.user) {
    return (
      <div className={className}>
        <Link className={`button button--ghost button--sm${block}`} href="/account/profile">
          Candidate dashboard
        </Link>
        <Link className={`button button--quiet button--sm${block}`} href="/employer">Employer dashboard</Link>
        <button
          className={`button button--quiet button--sm${block}`}
          onClick={async () => {
            await authClient.signOut();
            window.location.assign("/");
          }}
          type="button"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {menu ? (
        <Link className="button button--ghost button--sm button--block" href="/login?intent=start">
          Create a profile
        </Link>
      ) : null}
      <Link className={`button button--quiet button--sm${block}`} href="/login">
        Candidate login
      </Link>
      <Link className={`button button--quiet button--sm${block}`} href="/employer/login">Employer login</Link>
    </div>
  );
}
