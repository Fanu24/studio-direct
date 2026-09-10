import { tagLabel } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { companyHref } from "../_directory";
import { catalogMonthLabel } from "../../_components/board-chrome";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { ArrowRightIcon } from "../../_components/icons";
import { JobRowList } from "../../_components/job-row";
import { JsonLd, absoluteUrl } from "../../_components/json-ld";
import {
  decodeCompanySlug,
  isReservedCompanySlug,
} from "../../../lib/companies/queries";
import { buildJobPostingJsonLd } from "../../../lib/jobs/jsonld";
import {
  countNewJobs,
  getCompanyBySlug,
  getJobForListItem,
  listCompanyLocations,
  listCompanyTopTags,
  listJobs,
  type JobDetail,
  type JobListFilters,
  type JobsDatabase,
} from "../../../lib/jobs/queries";
import { requireTenantId } from "../../../lib/tenant";

export const revalidate = 300;

type CompanyParams = Promise<{ slug: string }>;
type SearchValue = string | string[] | undefined;
type CompanySearchParams = Promise<Record<string, SearchValue>>;

function first(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveNumber(value: SearchValue) {
  const parsed = Number(first(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function stringParam(value: SearchValue) {
  const raw = first(value)?.trim();
  return raw ? raw : undefined;
}

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

/**
 * Same first/last/current+-2 numbered-pager algorithm as
 * ../../_components/catalog-jobs.tsx's CatalogPager, kept local because that
 * component's href builder (`${path}?page=${page}`) can't compose with the
 * tag/location query params this page's filters also need - appending a
 * second "?" would break the URL. Same "pager" CSS class, same shape.
 */
function pagerPages(current: number, total: number): (number | "ellipsis")[] {
  const kept = new Set<number>([1, total]);
  for (let page = current - 2; page <= current + 2; page += 1) {
    if (page >= 1 && page <= total) kept.add(page);
  }
  const sorted = [...kept].sort((a, b) => a - b);

  const pages: (number | "ellipsis")[] = [];
  let previous: number | undefined;
  for (const page of sorted) {
    if (previous !== undefined && page - previous > 1) pages.push("ellipsis");
    pages.push(page);
    previous = page;
  }
  return pages;
}

/**
 * Cached per request (by slug + the primitive filter values) so
 * generateMetadata and the page component - which both resolve the same
 * searchParams independently - only pay for the company lookup, the job
 * listing, the per-row description fetch (for JobPosting JSON-LD) and the
 * tag/location facets once instead of twice.
 */
const loadCompany = cache(
  async (
    slug: string,
    page: number | undefined,
    tag: string | undefined,
    location: string | undefined,
  ) => {
    // /web3-companies/top-growing and /web3-companies/tag/... are static
    // routes under this same segment. Next resolves those first, so a
    // company that happened to slug to one of them would be unreachable -
    // 404 here rather than render a page no URL can reach.
    if (isReservedCompanySlug(slug)) return null;

    const { env } = await getCloudflareContext({ async: true });
    const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
    const tenantId = await requireTenantId(db);

    const company = await getCompanyBySlug(db, tenantId, slug);
    if (!company) return null;

    const filters: JobListFilters = {
      companyId: company.id,
      tag,
      locationSlug: location,
      page,
    };
    const result = await listJobs(db, tenantId, filters);

    // One JobPosting block per rendered row needs each row's full
    // description, which the list query doesn't carry - fetch them in
    // parallel, mirroring app/[slug]/page.tsx's same lookup.
    const details = (
      await Promise.all(result.jobs.map((job) => getJobForListItem(db, tenantId, job)))
    ).filter((job): job is JobDetail => job !== null);

    const topTags = await listCompanyTopTags(db, company.id);
    const locations = await listCompanyLocations(db, company.id);
    const newJobs = await countNewJobs(db, tenantId, { companyId: company.id }, 24);

    return { company, result, details, topTags, locations, newJobs };
  },
);

function loadCompanyData(slug: string, params: Record<string, SearchValue>) {
  return loadCompany(
    decodeCompanySlug(slug),
    positiveNumber(params.page),
    stringParam(params.tag),
    stringParam(params.location),
  );
}

/** "There is 1 Web3 job at X." / "There are N Web3 jobs at X." */
function roleCountSentence(total: number, name: string): string {
  if (total === 0) return `There is no listed Web3 job at ${name} right now.`;
  if (total === 1) return `There is 1 Web3 job at ${name}.`;
  return `There are ${total.toLocaleString("en-US")} Web3 jobs at ${name}.`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: CompanyParams;
  searchParams: CompanySearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadCompanyData(slug, await searchParams);
  if (!loaded) notFound();
  const { company, result, newJobs } = loaded;

  const month = catalogMonthLabel();
  const suffix = newJobs > 0 ? ` (${newJobs} New)` : "";
  const title = `${company.name} Careers - Jobs at ${company.name} - ${month}${suffix}`;
  const description = `${result.total} listed web3 ${
    result.total === 1 ? "role" : "roles"
  } at ${company.name} for ${month}${
    newJobs > 0 ? `, including ${newJobs} posted in the last day` : ""
  }.`;

  return {
    title,
    description,
    alternates: { canonical: companyHref(company.slug) },
  };
}

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: CompanyParams;
  searchParams: CompanySearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const loaded = await loadCompanyData(slug, sp);
  if (!loaded) notFound();

  const { company, result, details, topTags, locations } = loaded;
  const initial = company.name.trim().charAt(0).toUpperCase();
  const logoUrl = details.find((job) => job.companyLogoUrl)?.companyLogoUrl ?? null;
  const base = companyHref(company.slug);

  const activeTag = stringParam(sp.tag);
  const activeLocation = stringParam(sp.location);

  function filterHref(next: { tag?: string; location?: string }) {
    const query = new URLSearchParams();
    const tag = "tag" in next ? next.tag : activeTag;
    const location = "location" in next ? next.location : activeLocation;
    if (tag) query.set("tag", tag);
    if (location) query.set("location", location);
    const search = query.toString();
    return `${base}${search ? `?${search}` : ""}`;
  }

  function pageHref(page: number) {
    const query = new URLSearchParams();
    if (activeTag) query.set("tag", activeTag);
    if (activeLocation) query.set("location", activeLocation);
    query.set("page", String(page));
    return `${base}?${query.toString()}`;
  }

  const origin = requestOrigin(await headers());
  const jobPostings = details.map((job) => buildJobPostingJsonLd(job, origin));

  const organization: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.name,
    url: absoluteUrl(base),
    ...(logoUrl ? { logo: logoUrl } : {}),
    ...(company.domain ? { sameAs: [`https://${company.domain}`] } : {}),
  };

  return (
    <main className="surface surface--data">
      <JsonLd data={organization} />
      {jobPostings.map((posting, index) => (
        <JsonLd data={posting} key={`jobposting-${index}`} />
      ))}

      <header className="page-header jobs-studio-header">
        <Breadcrumbs
          items={[
            { href: "/jobs", label: "Jobs" },
            { href: "/web3-companies", label: "Web3 companies" },
            { label: company.name },
          ]}
        />
        {/*
          The profile shape: monogram, name, a real location and skill read,
          then the open-roles figure as a .stat - a page about one employer
          reads as a profile, not as a search result that happens to be
          alone. The filter chips below stay the interactive control; these
          are the summary.
        */}
        <div className="panel panel--lg company-profile">
          <div className="jobs-studio-header__row company-profile__id">
            <span aria-hidden="true" className="jobs-studio-mark">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="jobs-studio-logo" src={logoUrl} />
              ) : (
                initial
              )}
            </span>
            <div>
              <h1>{company.name} Jobs</h1>
              <p className="lead">{roleCountSentence(result.total, company.name)}</p>
              {company.domain || locations.length > 0 ? (
                <p className="company-profile__meta muted">
                  {company.domain ? (
                    <a href={`https://${company.domain}`} rel="nofollow noopener">
                      {company.domain}
                    </a>
                  ) : null}
                  {company.domain && locations.length > 0 ? " · " : null}
                  {locations.length > 0
                    ? locations
                        .slice(0, 3)
                        .map((row) => tagLabel(row.slug))
                        .join(", ")
                    : null}
                </p>
              ) : null}
            </div>
          </div>
          <div className="company-profile__aside">
            <div className="stat">
              <span className="stat__value stat__value--sm">
                {result.total > 0 ? (
                  <span className="m-count" data-reveal>
                    <span>{result.total}</span>
                  </span>
                ) : (
                  result.total
                )}
              </span>
              <span className="stat__label">{result.total === 1 ? "open role" : "open roles"}</span>
            </div>
            {topTags.length > 0 ? (
              <div className="company-profile__tags">
                {topTags.slice(0, 4).map((row) => (
                  <span className="chip chip--sm" key={row.slug}>
                    {tagLabel(row.slug)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {company.description ? (
            <div className="company-profile__about">
              <h2>About this company</h2>
              <p>{company.description}</p>
            </div>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="company-profile-cta" className="jobs-more">
        <div className="jobs-more__head">
          <div>
            <h2 id="company-profile-cta">Skip the queue at {company.name}</h2>
            <p>
              Put a profile in front of the teams that post here instead of firing off another
              cold application. It takes a couple of minutes and it stays private until you
              publish it.
            </p>
          </div>
          <Link className="button button--primary" href="/profile">
            Build your profile
          </Link>
        </div>
      </section>

      {topTags.length > 0 || locations.length > 0 ? (
        <section aria-label="Filter roles" className="jobs-company-filters">
          {topTags.length > 0 ? (
            <div className="chips">
              <Link
                className={`chip${!activeTag ? " chip--on" : ""}`}
                href={filterHref({ tag: undefined })}
              >
                All roles
              </Link>
              {topTags.map((row) => (
                <Link
                  className={`chip${activeTag === row.slug ? " chip--on" : ""}`}
                  href={filterHref({ tag: activeTag === row.slug ? undefined : row.slug })}
                  key={row.slug}
                >
                  {tagLabel(row.slug)}
                </Link>
              ))}
            </div>
          ) : null}
          {locations.length > 0 ? (
            <div className="chips">
              <Link
                className={`chip${!activeLocation ? " chip--on" : ""}`}
                href={filterHref({ location: undefined })}
              >
                All locations
              </Link>
              {locations.map((row) => (
                <Link
                  className={`chip${activeLocation === row.slug ? " chip--on" : ""}`}
                  href={filterHref({
                    location: activeLocation === row.slug ? undefined : row.slug,
                  })}
                  key={row.slug}
                >
                  {tagLabel(row.slug)}
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-label={`Jobs at ${company.name}`} className="jobs-results">
        <div className="jobs-results__head">
          <p className="count">
            <span className="jobs-num">{result.total}</span>{" "}
            {result.total === 1 ? "role" : "roles"}
          </p>
          <div className="jobs-results__aside">
            <Link className="text-link" href="/web3-companies">
              All companies
              <ArrowRightIcon size={15} />
            </Link>
          </div>
        </div>
        {JobRowList({
          emptyActions: (
            <Link className="button button--secondary" href="/jobs">
              Browse all jobs
            </Link>
          ),
          emptyMessage:
            activeTag || activeLocation
              ? `No roles at ${company.name} match this filter right now.`
              : `${company.name} has no listed jobs right now.`,
          jobs: result.jobs,
        })}
        {result.totalPages > 1 ? (
          <nav aria-label="Company jobs pagination" className="pager">
            {result.page > 1 ? <Link href={pageHref(result.page - 1)}>Previous</Link> : null}
            {pagerPages(result.page, result.totalPages).map((page, index) =>
              page === "ellipsis" ? (
                <span aria-hidden="true" key={`ellipsis-${index}`}>
                  &hellip;
                </span>
              ) : page === result.page ? (
                <span aria-current="page" key={page}>
                  {page}
                </span>
              ) : (
                <Link href={pageHref(page)} key={page}>
                  {page}
                </Link>
              ),
            )}
            {result.page < result.totalPages ? (
              <Link href={pageHref(result.page + 1)} rel="next">
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>

      <p className="jobs-back">
        <Link className="text-link" href="/web3-companies">
          See every company in the index
          <ArrowRightIcon size={16} />
        </Link>
      </p>
    </main>
  );
}
