"use client";

import Link from "next/link";

import { authClient } from "../../lib/auth/client";

export function NavAccount() {
  const { data: session } = authClient.useSession();

  if (session?.user) {
    return (
      <div className="nav-account">
        <button
          className="nav-ghost"
          onClick={async () => {
            await authClient.signOut();
            window.location.assign("/");
          }}
          type="button"
        >
          Sign out
        </button>
        <Link className="button" href="/dashboard">
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="nav-account">
      <Link className="button button--outline" href="/login">
        Login
      </Link>
      <Link className="button" href="/login?intent=start">
        Get started
      </Link>
    </div>
  );
}
