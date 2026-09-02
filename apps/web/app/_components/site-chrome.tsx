import Link from "next/link";
import type { ReactNode } from "react";

export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="site-nav">
        <Link className="wordmark" href="/">
          Studio Direct
        </Link>
        <nav className="nav-links" aria-label="Primary">
          <Link href="/jobs">Jobs</Link>
          <Link href="/hidden-jobs">Not on LinkedIn</Link>
          <Link href="/pricing">Pricing</Link>
          <Link className="cta" href="/login">
            Sign in
          </Link>
        </nav>
      </header>
      <div id="content">{children}</div>
      <footer className="site-footer">
        <p>Studio Direct. Roles from studio career pages.</p>
        <nav aria-label="Legal">
          <Link href="/pricing">Pricing</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </footer>
    </div>
  );
}
