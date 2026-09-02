import { HUB_ROLE_SLUGS } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";

import { HubLinks } from "../_components/hub-links";
import { ArrowRightIcon } from "../_components/icons";
import { JobCardGrid } from "../_components/job-card";
import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";
import { listJobs, type JobsDatabase } from "../../lib/jobs/queries";
import { TERMS_COPY } from "../../lib/legal/copy";

export const metadata: Metadata = {
  title: "Gaming jobs not posted on LinkedIn",
  description:
    "Remote and hybrid gaming jobs from studio career pages that our last successful index could not find on LinkedIn. Full descriptions, apply on the studio site.",
  alternates: { canonical: "/hidden-jobs" },
};

export const revalidate = 300;
export const dynamic = "force-dynamic";

export default async function HiddenJobsPage() {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("gaming")
    .first<string>("id");

  if (!tenantId) {
    throw new Error("Gaming tenant was not found");
  }

  const result = await listJobs(db, tenantId, { hidden: true });
  const noun = result.total === 1 ? "role" : "roles";

  return (
    <main>
      {/* The header is written inline so the tested h1 stays in the element tree the page test walks. */}
      <header className="page-header">
        <span className="kicker">The honest badge</span>
        <h1>Jobs not posted on LinkedIn</h1>
        <p className="lead">
          Remote and hybrid roles from studio career pages that our last successful index
          could not find on LinkedIn.
        </p>
      </header>

      <section
        aria-labelledby="hidden-badge-heading"
        className="panel panel--accent jobs-badge-panel"
      >
        <div className="jobs-badge-panel__intro">
          <span className="badge badge--lg" title={LINKEDIN_EXCLUSIVITY_TOOLTIP}>
            Not on LinkedIn
          </span>
          <h2 id="hidden-badge-heading">How the badge works</h2>
          <p>
            After each successful index we compare a studio&apos;s own listing against
            LinkedIn. When we cannot find the role there, the badge goes on. When we are not
            sure, it stays off.
          </p>
          <Link className="text-link" href="/terms">
            Read the terms
            <ArrowRightIcon size={16} />
          </Link>
        </div>
        <dl className="jobs-badge-panel__facts">
          <div>
            <dt>What the badge means</dt>
            <dd>{LINKEDIN_EXCLUSIVITY_TOOLTIP}</dd>
          </div>
          <div>
            <dt>What it does not mean</dt>
            <dd>{TERMS_COPY.noRealtimeLinkedIn}</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Jobs not on LinkedIn" className="jobs-results">
        <div className="jobs-results__head">
          <p className="count">
            <span className="jobs-num">{result.total}</span> {noun} right now
          </p>
          <div className="jobs-results__aside">
            <span className="tag">Newest first</span>
            {result.total > result.jobs.length ? (
              <Link href="/jobs?hidden=1">See all {result.total} in the catalog</Link>
            ) : null}
          </div>
        </div>
        <JobCardGrid
          emptyActions={
            <Link className="button button--secondary" href="/jobs">
              Browse all jobs
            </Link>
          }
          emptyMessage="No confirmed hidden jobs are available right now."
          headingLevel="h2"
          jobs={result.jobs}
        />
      </section>

      <section aria-labelledby="hidden-by-role" className="jobs-more">
        <div className="jobs-more__head">
          <div>
            <h2 id="hidden-by-role">Browse by role</h2>
            <p>Role hubs list every remote and hybrid role, on LinkedIn or not.</p>
          </div>
          <Link className="text-link" href="/roles">
            All {HUB_ROLE_SLUGS.length} roles
            <ArrowRightIcon size={16} />
          </Link>
        </div>
        <HubLinks limit={9} />
      </section>
    </main>
  );
}
