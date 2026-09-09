import { tagLabel } from "@gaming/shared";

import { HIRE_TAGS, hireGroups } from "./tags";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "../_components/breadcrumbs";
import { ArrowRightIcon } from "../_components/icons";
import { JsonLd, absoluteUrl } from "../_components/json-ld";
import type { JobsDatabase } from "../../lib/jobs/queries";
import { requireTenantId } from "../../lib/tenant";

export const metadata: Metadata = {
  title: "Hire Web3 talent from the catalog",
  description:
    "Hire Solidity, Solana, Rust, and other Web3 skills from jobs already listed on Nodework. Browse companies hiring by tag.",
  alternates: { canonical: "/hire" },
};

export const revalidate = 300;

const HUB_TAGS = HIRE_TAGS;

/** How many live job titles to preview on each hub card. */
const PREVIEW_JOBS_PER_CARD = 4;

/**
 * Rows scanned for the preview query, shared across every hub card. Ordered
 * by posted_at DESC and grouped client-side, so this is a ceiling on total
 * rows read, not a per-tag limit - one bulk query beats HUB_TAGS.length
 * separate ones (which, at 76 tags, was slow enough to stall the whole dev
 * server: every listJobs() call runs its own COUNT + SELECT, and the local
 * D1 connection serializes them).
 */
const PREVIEW_SCAN_LIMIT = 1500;

type HireHubCard = {
  slug: string;
  total: number;
  preview: { id: string; title: string; companyName: string }[];
};

async function loadHireHub(): Promise<HireHubCard[]> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);

  const placeholders = HUB_TAGS.map(() => "?").join(",");

  const [counts, previewRows] = await Promise.all([
    db
      .prepare(
        `SELECT jt.tag_slug AS slug, COUNT(DISTINCT j.id) AS jobCount
        FROM job_tags jt
        JOIN jobs j ON j.id = jt.job_id
        JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
        WHERE j.tenant_id = ? AND j.listed = 1 AND c.listed = 1
          AND jt.tag_slug IN (${placeholders})
        GROUP BY jt.tag_slug`,
      )
      .bind(tenantId, ...HUB_TAGS)
      .all<{ slug: string; jobCount: number | null }>(),
    db
      .prepare(
        `SELECT jt.tag_slug AS slug, j.id AS id, j.title AS title, c.name AS companyName
        FROM job_tags jt
        JOIN jobs j ON j.id = jt.job_id
        JOIN companies c ON c.id = j.company_id AND c.tenant_id = j.tenant_id
        WHERE j.tenant_id = ? AND j.listed = 1 AND c.listed = 1
          AND jt.tag_slug IN (${placeholders})
        ORDER BY j.posted_at DESC
        LIMIT ?`,
      )
      .bind(tenantId, ...HUB_TAGS, PREVIEW_SCAN_LIMIT)
      .all<{ slug: string; id: string; title: string; companyName: string }>(),
  ]);

  const countBySlug = new Map<string, number>(
    counts.results.map((row) => [row.slug, Number(row.jobCount ?? 0)]),
  );
  const previewBySlug = new Map<string, HireHubCard["preview"]>();
  for (const row of previewRows.results) {
    const list = previewBySlug.get(row.slug) ?? [];
    if (list.length < PREVIEW_JOBS_PER_CARD) {
      list.push({ id: row.id, title: row.title, companyName: row.companyName });
      previewBySlug.set(row.slug, list);
    }
  }

  const cards = HUB_TAGS.map((slug) => ({
    slug,
    total: countBySlug.get(slug) ?? 0,
    preview: previewBySlug.get(slug) ?? [],
  }));

  return cards.sort((a, b) => b.total - a.total || a.slug.localeCompare(b.slug));
}

export default async function HireHubPage() {
  const cards = await loadHireHub();
  const totalOpenRoles = cards.reduce((sum, card) => sum + card.total, 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Hire Web3 skills on Nodework",
    numberOfItems: cards.length,
    itemListElement: cards.map((card, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `Hire ${tagLabel(card.slug)}`,
      url: absoluteUrl(`/hire/${card.slug}`),
    })),
  };

  return (
    <main>
      <JsonLd data={jsonLd} />
      <header className="page-header">
        <Breadcrumbs items={[{ href: "/jobs", label: "Jobs" }, { label: "Hire" }]} />
        <h1>Hire from the Nodework catalog</h1>
        <p className="lead">
          Companies hiring a Web3 skill on Nodework show up here, sized by the live count
          below, not by a talent pool we do not have. {totalOpenRoles} open roles are
          currently spread across {cards.length} tracked skills.
        </p>
      </header>

      <article className="container container--content">
        <p>
          Nodework is a public job catalog. Hire hubs exist because the original Web3 job
          board IA included a hiring entry point, and because employers still ask “who is
          hiring Solidity” as a market question, not only “show me candidates.” We answer
          that with listings. If a company is hiring a skill, the skill page shows those
          jobs. If the tag has fewer than five roles, the page still renders and we ask
          crawlers not to index it.
        </p>
        <p>
          There is no applicant pool to buy, no resume search, and no outreach product
          behind these URLs. Candidates apply on Nodework. If you are hiring and want to
          be in the catalog, the listing has to be imported like every other job. This hub
          will not invent demand that the import does not have.
        </p>
        <p>
          Start with a skill below. Each card opens a skill hire page, with location
          slices built from where those jobs actually are. Candidates who want the same
          inventory without the hiring frame should use the job tag landings instead.
        </p>
      </article>

      <nav aria-label="Hire directory" className="container hire-directory">
        {hireGroups().map((group) => (
          <div className="hire-directory__group" key={group.key}>
            <h2 className="hire-directory__label">{group.label}</h2>
            <div className="chips">
              {group.slugs.map((slug) => (
                <Link className="chip" href={`/hire/${slug}`} key={slug}>
                  {tagLabel(slug)}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <section aria-label="Skills to hire" className="jobs-results">
        <div className="jobs-results__head">
          <p className="count">
            <span className="jobs-num">{cards.length}</span> skills tracked,{" "}
            <span className="jobs-num">{totalOpenRoles}</span> open roles live
          </p>
          <div className="jobs-results__aside">
            <Link className="text-link" href="/web3-companies">
              Companies
              <ArrowRightIcon size={15} />
            </Link>
          </div>
        </div>
        <ul className="jobs-role-grid">
          {cards.map((card) => {
            const label = tagLabel(card.slug);
            const roleWord = card.total === 1 ? "role" : "roles";
            const previewText =
              card.preview.length > 0
                ? ` Recent: ${card.preview
                    .map((job) => `${job.title} at ${job.companyName}`)
                    .join("; ")}.`
                : "";
            return (
              <li className="jobs-role-card" key={card.slug}>
                <h2 className="jobs-role-card__title">
                  <Link href={`/hire/${card.slug}`}>Hire {label}</Link>
                </h2>
                <p className="jobs-role-card__note">
                  {card.total} live {roleWord} for {label} on Nodework.{previewText}
                </p>
                <Link className="jobs-role-card__skill chip" href={`/${card.slug}-jobs`}>
                  {label} jobs
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
