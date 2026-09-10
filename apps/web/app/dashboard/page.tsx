import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountShell } from "../_components/account-shell";
import { ArrowRightIcon } from "../_components/icons";
import { JobCard } from "../_components/job-card";
import { createAuth, type AuthEnv } from "../../lib/auth/index";
import { listJobs, type JobsDatabase } from "../../lib/jobs/queries";
import {
  loadProfileCompleteness,
  loadProfileDetails,
  type CompletenessDatabase,
} from "../../lib/profile/completeness";
import {
  countUnlocksThisWeek,
  listRecentUnlocks,
  loadSubscriptionStatus,
  type UnlockHistoryDatabase,
} from "../../lib/unlocks/history";
import { FREE_UNLOCKS_PER_WEEK } from "../../lib/unlocks/quota";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your Nodework dashboard: profile, plan and recent activity.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/dashboard" },
};

type DashboardEnv = AuthEnv & {
  DB: JobsDatabase & CompletenessDatabase & UnlockHistoryDatabase;
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

async function dashboardEnv(): Promise<DashboardEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as DashboardEnv;
}

async function sessionUserId(env: DashboardEnv): Promise<string | null> {
  const session = await createAuth(env).api.getSession({
    headers: await headers(),
  });
  return session?.user?.id ?? null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_FORMAT.format(date);
}

export default async function DashboardPage() {
  const env = await dashboardEnv();
  const userId = await sessionUserId(env);

  if (!userId) {
    redirect("/login?next=/dashboard");
  }

  const now = new Date();
  const tenantId = await env.DB
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("nodework")
    .first<string>("id");

  if (!tenantId) {
    throw new Error("Nodework tenant was not found");
  }

  const [completeness, profile, used, subscription, recent, latest] = await Promise.all([
    loadProfileCompleteness(env.DB, userId),
    loadProfileDetails(env.DB, userId),
    countUnlocksThisWeek(env.DB, userId, now),
    loadSubscriptionStatus(env.DB, userId, now),
    listRecentUnlocks(env.DB, userId, 5),
    listJobs(env.DB, tenantId, { pageSize: 4 }),
  ]);

  const displayName = profile?.display_name?.trim();
  const paidUntil =
    subscription.paid && subscription.periodEnd ? formatDate(subscription.periodEnd) : null;
  const meter = Array.from({ length: FREE_UNLOCKS_PER_WEEK }, (_, index) => index < used);

  return (
    <AccountShell
      active="dashboard"
      lead="Your unlocks, profile and plan at a glance."
      title={displayName ? `Hi ${displayName}` : "Your dashboard"}
    >
      <section aria-label="Account summary" className="dash-tiles">
        <article className="panel panel--accent dash-tile dash-tile--unlocks">
          <span className="dash-tile__label">Unlocks this week</span>
          {subscription.paid ? (
            <p className="dash-tile__value dash-tile__value--text">Unlimited unlocks</p>
          ) : (
            <p className="dash-tile__value">
              {used}
              <small>of {FREE_UNLOCKS_PER_WEEK}</small>
            </p>
          )}
          {subscription.paid ? null : (
            <div aria-hidden="true" className="dash-meter">
              {meter.map((on, index) => (
                <span className={on ? "is-on" : undefined} key={index} />
              ))}
            </div>
          )}
          <p>
            {subscription.paid
              ? "Every unlock is free while your plan is active."
              : `${used} of ${FREE_UNLOCKS_PER_WEEK} used, resets Monday UTC`}
          </p>
          <Link className="button button--sm" href="/jobs">
            Browse jobs
          </Link>
        </article>

        <article className="panel dash-tile">
          <span className="dash-tile__label">Profile</span>
          <p className="dash-tile__value">
            {completeness}
            <small>% complete</small>
          </p>
          <p>
            {completeness >= 100
              ? "Everything is filled in."
              : "Add experience, three skills and a PDF CV to raise it."}
          </p>
          <Link className="button button--secondary button--sm" href="/profile">
            Edit profile
          </Link>
        </article>

        <article className="panel dash-tile">
          <span className="dash-tile__label">Plan</span>
          <p className="dash-tile__value dash-tile__value--text">
            {paidUntil ? `Paid until ${paidUntil}` : "Free plan"}
          </p>
          <p>
            {paidUntil
              ? "Unlimited unlocks through that date."
              : `${FREE_UNLOCKS_PER_WEEK} unlocks per UTC week on the free plan.`}
          </p>
          <Link className="button button--secondary button--sm" href="/pricing">
            See pricing
          </Link>
        </article>
      </section>

      <section aria-labelledby="dash-recent" className="dash-section">
        <div className="dash-section__head">
          <h2 id="dash-recent">Recent unlocks</h2>
          {recent.length > 0 ? <p className="count">last {recent.length}</p> : null}
        </div>
        {recent.length === 0 ? (
          <div className="empty">
            <p>No unlocks yet. Open a job and unlock the company&apos;s apply link.</p>
          </div>
        ) : (
          <ol className="acct-rows">
            {recent.map((unlock) => (
              <li key={unlock.jobId}>
                <span className="acct-rows__title">
                  <Link href={`/jobs/${unlock.slug}`}>{unlock.title}</Link>
                </span>
                <p className="acct-rows__meta">{unlock.companyName}</p>
                <time className="acct-rows__time" dateTime={unlock.unlockedAt}>
                  {formatDate(unlock.unlockedAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="dash-latest" className="dash-section">
        <div className="dash-section__head">
          <h2 id="dash-latest">Latest jobs</h2>
          <p className="count">{latest.total} right now</p>
        </div>
        {latest.jobs.length === 0 ? (
          <div className="empty">
            <p>No listed jobs are available right now.</p>
          </div>
        ) : (
          <ul className="job-grid">
            {latest.jobs.map((job) => (
              <li key={job.id}>{JobCard({ job })}</li>
            ))}
          </ul>
        )}
        <Link className="text-link" href="/jobs">
          Browse all jobs
          <ArrowRightIcon size={16} />
        </Link>
      </section>

      <div className="acct-soon">
        <section aria-labelledby="saved-title" className="panel acct-soon__panel">
          <h3 id="saved-title">
            Saved jobs <span className="tag">Not available yet</span>
          </h3>
          <p>A list of roles you want to come back to, saved from the job page.</p>
        </section>
        <section aria-labelledby="digest-title" className="panel acct-soon__panel">
          <h3 id="digest-title">
            Job alerts <span className="tag">Not available yet</span>
          </h3>
          <p>Email alerts when new matching Web3 roles are imported.</p>
        </section>
      </div>
    </AccountShell>
  );
}
