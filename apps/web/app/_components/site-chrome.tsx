import { hubSlugLabel, type HubRoleSlug } from "@gaming/shared";
import Link from "next/link";
import type { ReactNode } from "react";

import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";
import { NavAccount } from "./nav-account";
import { RevealObserver } from "./reveal-observer";

const NAV_LINKS = [
  { href: "/jobs", label: "Jobs" },
  { href: "/hidden-jobs", label: "Not on LinkedIn" },
  { href: "/companies", label: "Studios" },
  { href: "/pricing", label: "Pricing" },
] as const;

const FOOTER_ROLES: HubRoleSlug[] = [
  "gameplay-programmer",
  "engine-programmer",
  "technical-artist",
  "game-designer",
  "producer",
  "qa",
  "unreal",
  "unity",
];

export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="site-nav">
        <div className="container site-nav__inner">
          <Link className="wordmark" href="/">
            <span aria-hidden="true" className="wordmark__mark" />
            Studio Direct
          </Link>
          <NavLinks links={NAV_LINKS} />
          <div className="nav-actions">
            <NavAccount />
            <MobileMenu links={NAV_LINKS} />
          </div>
        </div>
      </header>
      <div id="content">{children}</div>
      <RevealObserver />
      <footer className="site-footer">
        <div className="container site-footer__grid">
          <div className="site-footer__brand">
            <Link className="wordmark" href="/">
              <span aria-hidden="true" className="wordmark__mark" />
              Studio Direct
            </Link>
            <p>
              Remote and hybrid gaming jobs, collected from studio career pages and
              listed with an honest signal about LinkedIn.
            </p>
          </div>
          <nav aria-label="Browse">
            <h2>Browse</h2>
            <Link href="/jobs">All jobs</Link>
            <Link href="/hidden-jobs">Not on LinkedIn</Link>
            <Link href="/companies">Studios</Link>
            <Link href="/roles">Roles</Link>
          </nav>
          <nav aria-label="Account">
            <h2>Account</h2>
            <Link href="/login">Sign in</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/pricing">Pricing</Link>
          </nav>
          <nav aria-label="Company">
            <h2>Company</h2>
            <Link href="/about">How it works</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
        </div>
        <div className="container site-footer__roles">
          <span>Popular roles</span>
          {FOOTER_ROLES.map((slug) => (
            <Link href={`/remote-${slug}-jobs`} key={slug}>
              Remote {hubSlugLabel(slug)} jobs
            </Link>
          ))}
        </div>
        <div className="container site-footer__legal">
          <p>Studio Direct. Roles from studio career pages.</p>
          <p>
            Listings come from studio career pages and other public sources.
            Not affiliated with LinkedIn.
          </p>
        </div>
      </footer>
    </div>
  );
}
