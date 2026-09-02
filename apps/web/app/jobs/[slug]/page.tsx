import { hubSlugLabel, jobHubSlugs } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs } from "../../_components/breadcrumbs";
import { ArrowRightIcon, CheckIcon } from "../../_components/icons";
import { remoteLabel } from "../../_components/job-card";
import { JsonLd } from "../../_components/json-ld";
import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../../lib/copy";
import { showBadge } from "../../../lib/jobs/exclusivity";
import { buildJobPostingJsonLd } from "../../../lib/jobs/jsonld";
import {
  getJobBySlug,
  type JobDetail,
  type JobsDatabase,
} from "../../../lib/jobs/queries";
import { sanitizeJobDescriptionHtml } from "../../../lib/jobs/sanitize-description";
import { UnlockApplyForm } from "./unlock-form";

export const revalidate = 300;

type JobParams = Promise<{ slug: string }>;

const META_DESCRIPTION_LIMIT = 158;

const POSTED_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function requestOrigin(requestHeaders: Headers) {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host");

  if (!host) {
    throw new Error("Request host was not found");
  }

  const forwardedProto = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol = forwardedProto === "http" ? "http" : "https";

  return `${protocol}://${host}`;
}

const loadJob = cache(async (slug: string): Promise<JobDetail | null> => {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("gaming")
    .first<string>("id");

  if (!tenantId) {
    throw new Error("Gaming tenant was not found");
  }

  return getJobBySlug(db, tenantId, slug);
});

function formatPostedLong(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return POSTED_FORMAT.format(date);
}

const MIN_LEAD_BLOCK_LENGTH = 40;

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1]?.toLowerCase() === "x"
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * First sentence of the first real paragraph in an HTML fragment. Headings are dropped and
 * short label-like blocks ("About the role") are skipped so the meta description starts with
 * an actual sentence.
 */
function firstSentence(html: string): string {
  const blocks = html
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "\n")
    .replace(
      /<\/(?:p|li|div|section|article|blockquote|tr|dd|dt|summary|figcaption|pre)>|<(?:br|hr)\s*\/?>/gi,
      "\n",
    )
    .replace(/<[^>]*>/g, " ")
    .split("\n")
    .map((block) => decodeEntities(block).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const text = blocks.find((block) => block.length >= MIN_LEAD_BLOCK_LENGTH) ?? blocks[0] ?? "";
  const match = /^(.+?[.!?])(?:\s|$)/.exec(text);
  return (match ? match[1] : text).trim();
}

function clampWords(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit + 1);
  const boundary = cut.lastIndexOf(" ");
  return cut.slice(0, boundary > 0 ? boundary : limit).replace(/[\s,;:]+$/, "");
}

/** Meta description: where, pay, then the opening sentence of the description. */
function buildMetaDescription(job: {
  title: string;
  companyName: string;
  remote: string;
  location: string | null;
  salaryText: string | null;
  descriptionHtml: string;
}): string {
  const where = job.location
    ? `${remoteLabel(job.remote)}, ${job.location}`
    : remoteLabel(job.remote);
  const facts = [`${job.title} at ${job.companyName}`, where];
  if (job.salaryText) facts.push(job.salaryText);
  const base = `${facts.join(". ")}.`;

  const sentence = firstSentence(sanitizeJobDescriptionHtml(job.descriptionHtml));
  if (!sentence) return clampWords(base, META_DESCRIPTION_LIMIT);

  const full = `${base} ${sentence}`;
  if (full.length <= META_DESCRIPTION_LIMIT) return full;
  if (base.length >= META_DESCRIPTION_LIMIT - 12) {
    return clampWords(base, META_DESCRIPTION_LIMIT);
  }
  return clampWords(full, META_DESCRIPTION_LIMIT);
}

export async function generateMetadata({
  params,
}: {
  params: JobParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await loadJob(slug);
  if (!job) notFound();

  const title = `${job.title} at ${job.companyName}`;
  const description = buildMetaDescription(job);
  const path = `/jobs/${job.slug}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function JobPage({ params }: { params: JobParams }) {
  const { slug } = await params;
  const job = await loadJob(slug);

  if (!job) {
    notFound();
  }

  const descriptionHtml = sanitizeJobDescriptionHtml(job.descriptionHtml);
  const jsonLd = buildJobPostingJsonLd(job, requestOrigin(await headers()));
  const matchingHubs = jobHubSlugs(job.title);
  const posted = formatPostedLong(job.postedAt);
  const badge = showBadge(job.exclusivity);
  const companyHref = `/companies/${job.companySlug}`;

  return (
    <main className="jd">
      <JsonLd data={jsonLd} />

      <Breadcrumbs
        items={[
          { href: "/jobs", label: "Jobs" },
          { href: companyHref, label: job.companyName },
          { label: job.title },
        ]}
      />

      <header className="jd-hero">
        {badge ? (
          <div className="jd-hero__badge">
            <span className="badge badge--lg" title={LINKEDIN_EXCLUSIVITY_TOOLTIP}>
              Not on LinkedIn
            </span>
            <span className="jd-hero__badge-note">{LINKEDIN_EXCLUSIVITY_TOOLTIP}</span>
          </div>
        ) : null}
        <h1 className="jd-hero__title">{job.title}</h1>
        <p className="jd-hero__studio">
          <Link className="jd-hero__studio-link" href={companyHref}>
            <span aria-hidden="true" className="jd-hero__studio-mark" />
            {job.companyName}
          </Link>
        </p>
        <ul aria-label="Role details" className="jd-meta">
          <li className="chip chip--on">{remoteLabel(job.remote)}</li>
          {job.location ? <li className="chip">{job.location}</li> : null}
          {job.salaryText ? (
            <li className="chip jd-meta__salary">{job.salaryText}</li>
          ) : null}
          {posted ? (
            <li className="chip">
              <time dateTime={job.postedAt ?? undefined}>Posted {posted}</time>
            </li>
          ) : null}
        </ul>
      </header>

      <div className="jd-layout">
        <aside aria-labelledby="jd-apply-title" className="jd-aside">
          <div className="jd-apply">
            <span className="kicker">Studio Direct unlock</span>
            <h2 className="jd-apply__title" id="jd-apply-title">
              Apply on the studio site
            </h2>
            <UnlockApplyForm jobId={job.id} next={`/jobs/${job.slug}`} />
            <ul className="jd-apply__notes">
              <li>
                <CheckIcon size={16} />
                <span>5 free unlocks per UTC week.</span>
              </li>
              <li>
                <CheckIcon size={16} />
                <span>You apply on the studio site.</span>
              </li>
              <li>
                <CheckIcon size={16} />
                <span>The link opens after you sign in.</span>
              </li>
            </ul>
          </div>
        </aside>

        <article className="jd-main">
          <section aria-labelledby="job-description" className="jd-description">
            <h2 className="jd-section-title" id="job-description">
              Job description
            </h2>
            <div
              className="jd-body"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          </section>

          <footer className="jd-foot">
            {matchingHubs.length > 0 ? (
              <nav aria-labelledby="related-hubs" className="jd-related">
                <h2 className="jd-section-title" id="related-hubs">
                  Related hubs
                </h2>
                <ul className="jd-related__list">
                  {matchingHubs.map((role) => (
                    <li key={role}>
                      <Link className="chip" href={`/remote-${role}-jobs`}>
                        Remote {hubSlugLabel(role)} jobs
                      </Link>
                      <Link className="chip" href={`/skills/${role}`}>
                        {hubSlugLabel(role)} skill jobs
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
            <p className="jd-more">
              <Link className="text-link" href={companyHref}>
                More at {job.companyName}
                <ArrowRightIcon size={16} />
              </Link>
            </p>
          </footer>
        </article>
      </div>
    </main>
  );
}
