import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";

import { Closing } from "./_components/home/closing";
import { Comparison } from "./_components/home/comparison";
import { FeatureRow } from "./_components/home/feature-row";
import { PricingTeaser } from "./_components/home/pricing-teaser";
import { StudioTicker } from "./_components/home/studio-ticker";
import { Testimonials } from "./_components/home/testimonials";
import { ArrowRightIcon, SearchIcon } from "./_components/icons";
import { JobCard } from "./_components/job-card";
import { JsonLd, absoluteUrl } from "./_components/json-ld";
import { ProductVideo } from "./_components/product-video";
import { CareerPagesTheater } from "./_components/theaters/career-pages-theater";
import { DigestTheater } from "./_components/theaters/digest-theater";
import { NotOnLinkedInTheater } from "./_components/theaters/not-on-linkedin-theater";
import { OneBoardTheater } from "./_components/theaters/one-board-theater";
import { SearchTheater } from "./_components/theaters/search-theater";
import { UnlockTheater } from "./_components/theaters/unlock-theater";
import { isStripeCheckoutEnabled } from "../lib/billing/plans";
import {
  HOMEPAGE_CLAIM,
  LINKEDIN_EXCLUSIVITY_TOOLTIP,
} from "../lib/copy";
import {
  listCompanies,
  listJobs,
  type JobsDatabase,
} from "../lib/jobs/queries";

export const revalidate = 300;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: "Studio Direct: remote gaming jobs from studio career pages",
  },
  description:
    "Remote and hybrid gaming jobs collected from studio career pages, with an honest badge for roles we could not find on LinkedIn. Search, read the full description, and apply on the studio site.",
  alternates: { canonical: "/" },
};

function homeJsonLd() {
  const origin = absoluteUrl("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Studio Direct",
        url: origin,
      },
      {
        "@type": "WebSite",
        name: "Studio Direct",
        url: origin,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${absoluteUrl("/jobs")}?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export default async function HomePage() {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("gaming")
    .first<string>("id");

  if (!tenantId) {
    throw new Error("Gaming tenant was not found");
  }

  const [hidden, listed, studios] = await Promise.all([
    listJobs(db, tenantId, { hidden: true, pageSize: 8 }),
    listJobs(db, tenantId, { pageSize: 1 }),
    listCompanies(db, tenantId),
  ]);
  const billingLive = isStripeCheckoutEnabled(
    (env as { STRIPE_ENABLED?: string }).STRIPE_ENABLED,
  );
  const { jobs } = hidden;

  return (
    <main className="marketing">
      <JsonLd data={homeJsonLd()} />

      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <span className="kicker">Remote and hybrid gaming jobs</span>
            <h1 className="hero__title">
              Gaming jobs, straight{" "}
              <span className="display-accent">from the studio.</span>
            </h1>
            <p className="hero__claim">{HOMEPAGE_CLAIM}</p>
            <form action="/jobs" className="hero__search" method="get" role="search">
              <label className="visually-hidden" htmlFor="hero-q">
                Search jobs
              </label>
              <div className="hero__field">
                <SearchIcon size={18} />
                <input
                  id="hero-q"
                  name="q"
                  placeholder="Gameplay engineer, Unreal, live ops"
                  type="search"
                />
              </div>
              <button className="button button--lg" type="submit">
                Search jobs
              </button>
            </form>
            <Link className="text-link hero__secondary" href="/hidden-jobs">
              Jobs not on LinkedIn
              <ArrowRightIcon size={16} />
            </Link>
          </div>
          <div className="hero__media">
            <ProductVideo
              aspect="standard"
              caption="studio career pages, indexed"
              title="Career pages first: studio listings flow into one board"
            >
              <CareerPagesTheater />
            </ProductVideo>
          </div>
        </div>
      </section>

      <StudioTicker studios={studios} />

      <section className="section">
        <div className="container features">
          <FeatureRow
            caption="/jobs/senior-gameplay-engineer"
            kicker="The honest badge"
            note={LINKEDIN_EXCLUSIVITY_TOOLTIP}
            theater={<NotOnLinkedInTheater />}
            title="Not on LinkedIn means we checked."
            videoTitle="The honest badge: an index pass compares the listing with LinkedIn"
          >
            <p>
              After each successful index we compare a studio&apos;s own listing against
              LinkedIn. When we cannot find the role there, the badge goes on. When we are
              not sure, it stays off.
            </p>
          </FeatureRow>
          <FeatureRow
            caption="/remote-gameplay-programmer-jobs"
            kicker="Career pages first"
            reverse
            theater={<OneBoardTheater />}
            title="One board for the roles studios post on their own sites."
            videoTitle="One board: roles from several studios in a single hub"
          >
            <p>
              We read studio career pages and their applicant tracking boards, keep the
              remote and hybrid roles, and list each one with its full description.
            </p>
          </FeatureRow>
        </div>
      </section>

      <section className="band section feature-band">
        <div className="container">
          <div className="feature-band__copy" data-reveal>
            <span className="kicker">Search and filters</span>
            <h2>Find the role in seconds, not tabs.</h2>
            <p>
              Full-text search across titles and descriptions. Filter by studio, seniority,
              source, and roles not posted on LinkedIn.
            </p>
          </div>
          <div data-reveal data-reveal-delay="1">
            <ProductVideo
              aspect="wide"
              caption="/jobs?q=Gameplay"
              title="Search: typing Gameplay narrows the board to one role"
            >
              <SearchTheater />
            </ProductVideo>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container feature-pair">
          <div className="feature-pair__item" data-reveal>
            <div>
              <span className="kicker">Apply on the studio site</span>
              <h2>Unlock the studio&apos;s apply link.</h2>
              <p>
                Five free unlocks per week, counted Monday to Sunday UTC. Every application
                happens on the studio&apos;s own site, never through us.
              </p>
            </div>
            <ProductVideo
              aspect="tall"
              caption="/jobs/live-ops-designer"
              title="Unlock: the apply link opens on the studio site after one click"
            >
              <UnlockTheater />
            </ProductVideo>
          </div>
          <div className="feature-pair__item" data-reveal data-reveal-delay="1">
            <div>
              <span className="kicker">Hidden digest</span>
              <h2>New roles not on LinkedIn, in your inbox.</h2>
              <p>
                A short email when the index finds roles that are not on LinkedIn. Part of
                the paid plan once billing is live.
              </p>
            </div>
            <ProductVideo
              aspect="tall"
              caption="hidden digest"
              tag="Paid plan, not live yet"
              title="Hidden digest: a short email listing new roles not on LinkedIn"
            >
              <DigestTheater />
            </ProductVideo>
          </div>
        </div>
      </section>

      <Comparison studios={studios.length} />

      <Testimonials />

      <PricingTeaser billingLive={billingLive} />

      <section aria-labelledby="latest-hidden-jobs" className="section latest">
        <div className="container">
          <div className="latest__head" data-reveal>
            <div>
              <h2 id="latest-hidden-jobs">Latest jobs not on LinkedIn</h2>
              <p>
                Roles our last successful index could not find on LinkedIn. Each badge
                carries the same sentence.
              </p>
            </div>
            <p className="count">{hidden.total} right now</p>
          </div>
          {jobs.length === 0 ? (
            <div className="empty">
              <p>No confirmed hidden jobs are available right now.</p>
            </div>
          ) : (
            <ul className="job-grid">
              {/* Called as a function so the job title stays in the element tree the page tests walk. */}
              {jobs.map((job) => (
                <li key={job.id}>{JobCard({ job })}</li>
              ))}
            </ul>
          )}
          <p className="latest__more">
            <Link className="button button--secondary" href="/hidden-jobs">
              View all jobs not on LinkedIn
            </Link>
          </p>
        </div>
      </section>

      <Closing hidden={hidden.total} listed={listed.total} />
    </main>
  );
}
