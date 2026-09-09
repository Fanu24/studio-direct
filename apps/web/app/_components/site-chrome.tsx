import Link from "next/link";
import type { ReactNode } from "react";

import { FOOTER_COLUMNS } from "./footer-data";
import { MobileMenu } from "./mobile-menu";
import { NavAccount } from "./nav-account";
import { NAV_MENUS } from "./nav-data";
import { NavMega } from "./nav-mega";
import { RevealObserver } from "./reveal-observer";

const LAUNCH_YEAR = 2026;

/**
 * The mark: an open ring in the aurora sweep with one loose node at the gap.
 * Gradient stops read the palette tokens, so the mark recolours with the system.
 * `id` keeps the gradient unique when the mark renders twice on a page.
 */
function Mark({ id }: { id: string }) {
  return (
    <svg
      aria-hidden="true"
      className="wordmark__mark"
      focusable="false"
      height="22"
      viewBox="0 0 22 22"
      width="22"
    >
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--accent)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--violet)" }} />
          <stop offset="1" style={{ stopColor: "var(--cool)" }} />
        </linearGradient>
      </defs>
      <circle
        cx="11"
        cy="11"
        fill="none"
        r="7.5"
        stroke={`url(#${id})`}
        strokeDasharray="37 10.1"
        strokeLinecap="round"
        strokeWidth="3"
        transform="rotate(-62 11 11)"
      />
      <circle cx="9.6" cy="3.6" r="2.1" style={{ fill: "var(--cool)" }} />
    </svg>
  );
}

export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="site-nav">
        <div className="container site-nav__inner">
          <Link className="wordmark" href="/">
            <Mark id="nw-mark-header" />
            Nodework
          </Link>
          <NavMega menus={NAV_MENUS} />
          <div className="nav-actions">
            <NavAccount />
            <Link className="button button--primary button--sm" href="/post-web3-job">
              Post a job
            </Link>
            <MobileMenu menus={NAV_MENUS} />
          </div>
        </div>
      </header>
      <div id="content">{children}</div>
      <RevealObserver />
      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div className="site-footer__brand">
            <Link className="wordmark" href="/">
              <Mark id="nw-mark-footer" />
              Nodework
            </Link>
            <p>
              An index of Web3, blockchain and crypto roles, with salary bands built from
              the jobs themselves.
            </p>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <nav aria-label={column.heading} className="footer-column" key={column.heading}>
              <h2>
                {column.hubHref ? (
                  <Link href={column.hubHref}>{column.heading}</Link>
                ) : (
                  column.heading
                )}
              </h2>
              <div className="footer-column__links">
                {column.links.map((link) => (
                  <Link href={link.href} key={`${column.heading}-${link.href}`}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </nav>
          ))}
        </div>
        <div className="site-footer__legal">
          <div className="container">
            <p>
              &copy; {LAUNCH_YEAR} <Link href="/">Nodework</Link>. All rights reserved.
            </p>
            <ul className="site-footer__meta">
              <li>
                <Link href="/terms">Terms</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/legal">Legal</Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
