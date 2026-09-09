import { SENIORITY_SLUGS, formatSalaryRange, tagLabel } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { BoardSearch, RelatedBrowseLinks, catalogMonthLabel } from "../../_components/board-chrome";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { JobBoard } from "../../_components/job-board";
import { TagChips } from "../../_components/job-row";
import { JsonLd, absoluteUrl } from "../../_components/json-ld";
import {
  SalaryBarChart,
  SalarySeniorityChart,
  type SalaryChartRow,
} from "../../_components/salary-chart";
import { SalaryBreakdownTable, SalaryStatsTable } from "../../_components/salary-tables";
import { buildJobPostingJsonLd } from "../../../lib/jobs/jsonld";
import { buildLandingTitle } from "../../../lib/jobs/landing-meta";
import {
  getJobForListItem,
  listJobs,
  resolveSalaryBreakdown,
  resolveSalaryStats,
  type JobDetail,
  type JobListItem,
  type JobsDatabase,
  type SalaryRollupRow,
} from "../../../lib/jobs/queries";
import { requireTenantId } from "../../../lib/tenant";

export const revalidate = 300;

const PATH = "/web3-salaries/solana-vs-ethereum";
const JOB_POSTING_LIMIT = 10;
const COMBINED_JOBS = 20;

function requestOrigin(requestHeaders: Headers) {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host");
  if (!host) throw new Error("Request host was not found");
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto === "http" ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const month = catalogMonthLabel();
  const title = buildLandingTitle({
    headline: "Solana vs Ethereum salary",
    month,
    newJobs: 0,
  });
  return {
    title,
    description: `Solana developer and Ethereum developer salary bands on Nodework for ${month}, compared side by side from listings that published a pay band.`,
    alternates: { canonical: PATH },
  };
}

/** Percent by which `a` beats `b`, rounded, or null when there is nothing to divide by. */
function percentDelta(a: number, b: number): number | null {
  if (b === 0) return null;
  return Math.round(((a - b) / b) * 100);
}

function deltaSentence(
  solana: SalaryRollupRow | null,
  ethereum: SalaryRollupRow | null,
): string {
  if (!solana || !ethereum) {
    const missing = !solana && !ethereum ? "Solana and Ethereum developer" : !solana ? "Solana developer" : "Ethereum developer";
    return `Nodework does not yet have a published salary band for ${missing} roles, so there is no live comparison to show yet.`;
  }
  const delta = percentDelta(solana.avg, ethereum.avg);
  if (delta === null || delta === 0) {
    return `Solana developer roles average ${formatSalaryRange(solana.avg, solana.avg)} and Ethereum developer roles average ${formatSalaryRange(ethereum.avg, ethereum.avg)} on Nodework right now - close enough to call even.`;
  }
  const direction = delta > 0 ? "higher" : "lower";
  return `Solana developer roles average ${formatSalaryRange(solana.avg, solana.avg)} on Nodework, ${Math.abs(delta)}% ${direction} than Ethereum developer roles at ${formatSalaryRange(ethereum.avg, ethereum.avg)}.`;
}

function conclusionSentence(
  solana: SalaryRollupRow | null,
  ethereum: SalaryRollupRow | null,
  solanaJobs: number,
  ethereumJobs: number,
): string {
  if (!solana || !ethereum) {
    return "Nodework does not have enough published salary bands for both stacks yet to draw a conclusion. Compare the live job counts and open listings below instead.";
  }
  const delta = percentDelta(solana.avg, ethereum.avg);
  const busier =
    solanaJobs === ethereumJobs
      ? "an even number of listings for each stack"
      : solanaJobs > ethereumJobs
        ? `more Solana developer listings (${solanaJobs} vs ${ethereumJobs})`
        : `more Ethereum developer listings (${ethereumJobs} vs ${solanaJobs})`;
  if (delta === null || delta === 0) {
    return `On Nodework's current listings, Solana and Ethereum developer pay is effectively even, and the catalog carries ${busier}. Neither stack is the clear higher-paying choice right now - pick based on the ecosystem and tooling you want to work in.`;
  }
  const winner = delta > 0 ? "Solana" : "Ethereum";
  return `On Nodework's current listings, ${winner} developer roles pay more on average, and the catalog carries ${busier}. That gap can move as new jobs are imported, so treat this as a snapshot for ${catalogMonthLabel()}, not a permanent ranking.`;
}

function dedupeJobs(jobs: JobListItem[]): JobListItem[] {
  const seen = new Set<string>();
  const unique: JobListItem[] = [];
  for (const job of jobs) {
    if (seen.has(job.id)) continue;
    seen.add(job.id);
    unique.push(job);
  }
  return unique;
}

export default async function SolanaVsEthereumSalaryPage() {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);

  const [solana, ethereum, solidity, solanaJobs, ethereumJobs, solanaSeniority, ethereumSeniority, solanaCountry, ethereumCountry] =
    await Promise.all([
      resolveSalaryStats(db, tenantId, "role", "solana-developer"),
      resolveSalaryStats(db, tenantId, "role", "ethereum-developer"),
      resolveSalaryStats(db, tenantId, "role", "solidity-developer"),
      listJobs(db, tenantId, { tag: "solana", orTitle: true, pageSize: COMBINED_JOBS }),
      listJobs(db, tenantId, { tag: "ethereum", orTitle: true, pageSize: COMBINED_JOBS }),
      resolveSalaryBreakdown(db, tenantId, { tag: "solana" }, "seniority"),
      resolveSalaryBreakdown(db, tenantId, { tag: "ethereum" }, "seniority"),
      resolveSalaryBreakdown(db, tenantId, { tag: "solana" }, "country"),
      resolveSalaryBreakdown(db, tenantId, { tag: "ethereum" }, "country"),
    ]);

  const combined = dedupeJobs([...solanaJobs.jobs, ...ethereumJobs.jobs])
    .sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""))
    .slice(0, COMBINED_JOBS);
  const selected = await getJobForListItem(db, tenantId, combined[0]);
  const details = (
    await Promise.all(
      combined.slice(0, JOB_POSTING_LIMIT).map((job) => getJobForListItem(db, tenantId, job)),
    )
  ).filter((job): job is JobDetail => job !== null);

  const month = catalogMonthLabel();
  const title = buildLandingTitle({ headline: "Solana vs Ethereum salary", month, newJobs: 0 });
  const chartRows: (SalaryChartRow | null)[] = [
    solana ? { slug: "solana-developer", avg: solana.avg, min: solana.min, max: solana.max, href: "/web3-salaries/solana-developer" } : null,
    ethereum ? { slug: "ethereum-developer", avg: ethereum.avg, min: ethereum.min, max: ethereum.max, href: "/web3-salaries/ethereum-developer" } : null,
    solidity ? { slug: "solidity-developer", avg: solidity.avg, min: solidity.min, max: solidity.max, href: "/web3-salaries/solidity-developer" } : null,
  ];
  const chartRowsFiltered: SalaryChartRow[] = chartRows.filter(
    (row): row is SalaryChartRow => row !== null,
  );

  const comparisonRows = [
    { slug: "solana-developer", avg: solana?.avg ?? null, min: solana?.min ?? null, max: solana?.max ?? null },
    { slug: "ethereum-developer", avg: ethereum?.avg ?? null, min: ethereum?.min ?? null, max: ethereum?.max ?? null },
    { slug: "solidity-developer", avg: solidity?.avg ?? null, min: solidity?.min ?? null, max: solidity?.max ?? null },
  ];

  const ratio =
    ethereumJobs.total > 0
      ? `${solanaJobs.total}:${ethereumJobs.total}`
      : solanaJobs.total > 0
        ? `${solanaJobs.total}:0`
        : "0:0";

  const solanaSeniorityPoints = SENIORITY_SLUGS.map((seniority) => {
    const row = solanaSeniority.find((entry) => entry.slug === seniority);
    return {
      slug: seniority,
      label: tagLabel(seniority),
      href: `/web3-salaries/${seniority}`,
      avg: row?.avg ?? null,
      max: row?.max ?? null,
    };
  });
  const ethereumSeniorityPoints = SENIORITY_SLUGS.map((seniority) => {
    const row = ethereumSeniority.find((entry) => entry.slug === seniority);
    return {
      slug: seniority,
      label: tagLabel(seniority),
      avg: row?.avg ?? null,
      max: row?.max ?? null,
    };
  });

  const origin = requestOrigin(await headers());
  const blogPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: deltaSentence(solana, ethereum),
    url: absoluteUrl(PATH),
    dateModified: new Date().toISOString(),
    author: { "@type": "Organization", name: "Nodework" },
    publisher: { "@type": "Organization", name: "Nodework" },
  };

  return (
    <main className="surface surface--data">
      <JsonLd data={blogPostingJsonLd} />
      {details.map((job) => (
        <JsonLd data={buildJobPostingJsonLd(job, origin)} key={job.id} />
      ))}
      <div className="container">
        <header className="page-header">
          <Breadcrumbs
            items={[
              { href: "/jobs", label: "Jobs" },
              { href: "/web3-salaries", label: "Web3 salaries" },
              { label: "Solana vs Ethereum salary" },
            ]}
          />
          <h1>{title}</h1>
          <p className="lead">{deltaSentence(solana, ethereum)}</p>
        </header>
        <BoardSearch remoteHref="/remote-jobs" />
        <TagChips />
      </div>

      <article className="container container--content">
        <h2>How do Solana and Ethereum salaries compare?</h2>
        <p>{deltaSentence(solana, ethereum)}</p>
        <SalaryBarChart
          chartLabel="Solana vs Ethereum vs Solidity salary"
          emptyMessage="No published salary band for either stack yet."
          rows={chartRowsFiltered}
        />
        <SalaryStatsTable
          hrefFor={(slug) => `/web3-salaries/${slug}`}
          labelHeader="Stack"
          rows={comparisonRows}
          slugs={["solana-developer", "ethereum-developer", "solidity-developer"]}
        />

        <h2>How many jobs are open for each stack?</h2>
        <p>
          Nodework currently lists {solanaJobs.total} Solana developer{" "}
          {solanaJobs.total === 1 ? "job" : "jobs"} versus {ethereumJobs.total} Ethereum
          developer {ethereumJobs.total === 1 ? "job" : "jobs"}, a ratio of {ratio}.
        </p>

        <h2>Salary by seniority</h2>
        <p>Average pay by seniority level for each stack, where Nodework has the data.</p>
        <SalarySeniorityChart
          compare={{ label: "Ethereum developer", points: ethereumSeniorityPoints }}
          emptyMessage="No seniority breakdown available yet for either stack."
          label="Solana developer"
          points={solanaSeniorityPoints}
        />
        <div className="grid grid--2">
          <SalaryBreakdownTable
            heading="Solana developer by seniority"
            headingLevel="h3"
            hrefFor={(slug) => `/web3-salaries/${slug}`}
            labelHeader="Seniority"
            rows={solanaSeniority}
          />
          <SalaryBreakdownTable
            heading="Ethereum developer by seniority"
            headingLevel="h3"
            hrefFor={(slug) => `/web3-salaries/${slug}`}
            labelHeader="Seniority"
            rows={ethereumSeniority}
          />
        </div>

        <h2>Salary by location</h2>
        <p>Average pay by country for each stack, where Nodework has the data.</p>
        <div className="grid grid--2">
          <SalaryBreakdownTable
            heading="Solana developer by country"
            headingLevel="h3"
            hrefFor={(slug) => `/web3-salaries/${slug}`}
            labelHeader="Country"
            rows={solanaCountry}
          />
          <SalaryBreakdownTable
            heading="Ethereum developer by country"
            headingLevel="h3"
            hrefFor={(slug) => `/web3-salaries/${slug}`}
            labelHeader="Country"
            rows={ethereumCountry}
          />
        </div>

        <h2>Conclusion</h2>
        <p>{conclusionSentence(solana, ethereum, solanaJobs.total, ethereumJobs.total)}</p>
      </article>

      <section className="container">
        <h2>Open Solana and Ethereum jobs</h2>
      </section>
      <JobBoard
        emptyMessage="No Solana or Ethereum jobs listed right now."
        jobs={combined}
        selected={selected}
      />

      <section className="container">
        <p className="cluster" style={{ marginTop: 24 }}>
          <Link className="text-link" href="/solana-jobs">
            Solana jobs
          </Link>
          <Link className="text-link" href="/solidity-jobs">
            Solidity jobs
          </Link>
        </p>
      </section>
      <RelatedBrowseLinks tag="solana" />
    </main>
  );
}
