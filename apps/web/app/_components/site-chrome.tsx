import Link from "next/link";
import type { ReactNode } from "react";

import { FOOTER_COLUMNS } from "./footer-data";
import { MobileMenu } from "./mobile-menu";
import { NavAccount } from "./nav-account";
import { NAV_MENUS } from "./nav-data";
import { NavMega } from "./nav-mega";
import { RevealObserver } from "./reveal-observer";
import "./nav-chrome.css";
import "../styles/footer.css";

const LAUNCH_YEAR = 2026;

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
            Nodework
          </Link>
          <NavMega menus={NAV_MENUS} />
          <div className="nav-actions">
            <NavAccount />
            <Link className="button button--primary" href="/post-web3-job">
              Post a job
            </Link>
            <MobileMenu menus={NAV_MENUS} />
          </div>
        </div>
      </header>
      <div id="content">{children}</div>
      <RevealObserver />
      <footer className="site-footer">
        <div className="container site-footer__columns">
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
              &copy; {LAUNCH_YEAR} <Link href="/">Nodework</Link>. An index of Web3,
              blockchain and crypto roles, with salary bands built from the jobs
              themselves.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
