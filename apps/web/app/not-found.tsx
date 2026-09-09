import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon } from "./_components/icons";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="surface surface--data nf">
        <div className="nf__inner">
          <span className="kicker">404</span>
          <h1>This page does not exist.</h1>
          <p className="lead">
            The link may be out of date, or the studio may have taken the listing down.
          </p>
          <div className="cluster">
            <Link className="button" href="/jobs">
              Browse jobs
            </Link>
            <Link className="button button--secondary" href="/companies">
              Companies
            </Link>
            <Link className="text-link" href="/">
              Back to the homepage
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </main>
  );
}
