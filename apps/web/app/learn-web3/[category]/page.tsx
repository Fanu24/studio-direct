import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleLayout } from "../../_components/article-layout";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { JobCardGrid } from "../../_components/job-card";
import { ResourceGrid } from "../../_components/resource-grid";
import { listJobs, type JobsDatabase } from "../../../lib/jobs/queries";
import { requireTenantId } from "../../../lib/tenant";
import {
  LEARN_CATEGORIES,
  LEARN_FACETS,
  isLearnCategory,
  isLearnTopic,
  isLearnTopicJobTag,
  learnCategoryLabel,
  learnRelatedJobLinks,
} from "../categories";
import { LEARN_COPY } from "../copy";
import { resourceCountForCategory, resourcesForCategory } from "../resources";

// Read live D1 data at request time; builds must not depend on a local database.
export const dynamic = "force-dynamic";

type LearnCategoryParams = Promise<{ category: string }>;

export function generateStaticParams() {
  return LEARN_CATEGORIES.map((category) => ({ category }));
}

/**
 * Topic pages target "{topic} tutorials" / "learn {topic} web3" with the
 * live resource count baked into the H1 and description, per the P14 SEO
 * intent. Format and level pages keep their hand-written LEARN_COPY title
 * and description as-is - the count-in-H1 treatment is a topic-page thing,
 * not a whole-vocabulary rewrite.
 */
function topicHeroTitle(label: string, count: number): string {
  if (count === 0) return `Learn ${label} for Web3 Jobs`;
  return `${count} ${label} Resource${count === 1 ? "" : "s"} to Learn Web3`;
}

function topicHeroDescription(label: string, count: number, hasJobTag: boolean): string {
  const resourcePart =
    count === 0
      ? `Original Nodework notes on ${label} for Web3 work`
      : `${count} curated ${label} resource${count === 1 ? "" : "s"} to learn Web3`;
  return hasJobTag
    ? `${resourcePart}, plus live ${label} jobs on Nodework.`
    : `${resourcePart}, plus where ${label} fits in the Nodework job catalog.`;
}

export async function generateMetadata({
  params,
}: {
  params: LearnCategoryParams;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isLearnCategory(category)) notFound();
  const copy = LEARN_COPY[category];
  const label = learnCategoryLabel(category);
  const title = isLearnTopic(category)
    ? topicHeroTitle(label, resourceCountForCategory(category))
    : copy.title;
  const description = isLearnTopic(category)
    ? topicHeroDescription(
        label,
        resourceCountForCategory(category),
        isLearnTopicJobTag(category),
      )
    : copy.description;
  return {
    title,
    description,
    alternates: { canonical: `/learn-web3/${category}` },
  };
}

export default async function LearnCategoryPage({
  params,
}: {
  params: LearnCategoryParams;
}) {
  const { category } = await params;
  if (!isLearnCategory(category)) notFound();
  const copy = LEARN_COPY[category];
  const label = learnCategoryLabel(category);
  const isTopic = isLearnTopic(category);
  const isJobTagTopic = isLearnTopicJobTag(category);
  const resources = resourcesForCategory(category);

  const heroTitle = isTopic ? topicHeroTitle(label, resources.length) : copy.title;
  const heroDescription = isTopic
    ? topicHeroDescription(label, resources.length, isJobTagTopic)
    : copy.description;

  const relatedLinks = learnRelatedJobLinks(category);
  const relatedHeading = isJobTagTopic ? `${label} jobs on Nodework` : "Open the catalog";

  let relatedJobs: Awaited<ReturnType<typeof listJobs>>["jobs"] = [];
  if (isJobTagTopic) {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
    const tenantId = await requireTenantId(db);
    const result = await listJobs(db, tenantId, { tag: category, pageSize: 6 });
    relatedJobs = result.jobs;
  }

  return (
    <ArticleLayout
      breadcrumbs={
        <Breadcrumbs
          items={[
            { href: "/learn-web3", label: "Learn Web3" },
            { label },
          ]}
        />
      }
      lead={heroDescription}
      related={
        <>
          <h2>{relatedHeading}</h2>
          {isJobTagTopic ? (
            <>
              <JobCardGrid
                emptyActions={
                  <Link className="button button--sm" href={`/${category}-jobs`}>
                    Browse {label} jobs
                  </Link>
                }
                emptyMessage={`No live ${label} postings are open on Nodework right now. The tag stays live, so check back or browse the wider catalog.`}
                jobs={relatedJobs}
              />
              <div className="chips">
                {relatedLinks.map((link) => (
                  <Link className="chip" href={link.href} key={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="chips">
              {relatedLinks.map((link) => (
                <Link className="chip" href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </>
      }
      title={heroTitle}
      toc={[
        { href: "/learn-web3", label: "Learn hub" },
        { href: "/learn-web3/all", label: "All formats" },
        { href: "#browse", label: "Browse Learn Web3" },
        { href: "#resources", label: "Resources" },
      ]}
    >
      {copy.paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 32)}>{paragraph}</p>
      ))}
      <section aria-label="Browse Learn Web3 by facet" className="learn-facets" id="browse">
        {LEARN_FACETS.map((facet) => (
          <div className="learn-facet-group" key={facet.key}>
            <h2>{facet.label}</h2>
            <div className="chips">
              {facet.slugs.map((slug) => (
                <Link
                  className={slug === category ? "chip chip--on" : "chip"}
                  href={`/learn-web3/${slug}`}
                  key={slug}
                >
                  {learnCategoryLabel(slug)}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section aria-labelledby="learn-resources-heading" id="resources">
        <div className="learn-resources__head">
          <h2 id="learn-resources-heading">
            {resources.length} {label} resource{resources.length === 1 ? "" : "s"}
          </h2>
          <p>
            Original picks, each linking straight to the publisher&apos;s own site. Nodework
            does not host or republish the material.
          </p>
        </div>
        <ResourceGrid
          emptyMessage={`No curated ${label} resources are listed yet. Browse the facets above or open a related job tag while this page fills in.`}
          resources={resources}
        />
      </section>
    </ArticleLayout>
  );
}
