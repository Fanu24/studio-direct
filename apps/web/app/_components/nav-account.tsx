"use client";

import Link from "next/link";

import { authClient } from "../../lib/auth/client";

export function NavAccount() {
  const { data: session } = authClient.useSession();

  if (session?.user) {
    return (
      <>
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
      </>
    );
  }

  return (
    <Link className="button" href="/login">
      Sign in
    </Link>
  );
}
