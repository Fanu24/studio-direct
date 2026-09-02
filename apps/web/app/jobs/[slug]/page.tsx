import { HUB_ROLE_SLUGS, hubSlugLabel } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../../lib/copy";
import { showBadge } from "../../../lib/jobs/exclusivity";
import { buildJobPostingJsonLd } from "../../../lib/jobs/jsonld";
import {
  getJobBySlug,
  type JobsDatabase,
} from "../../../lib/jobs/queries";
import { sanitizeJobDescriptionHtml } from "../../../lib/jobs/sanitize-description";

export const dynamic = "force-dynamic";

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

export default async function JobPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await db
    .prepare("SELECT id FROM tenants WHERE slug = ?")
    .bind("gaming")
    .first<string>("id");

  if (!tenantId) {
    throw new Error("Gaming tenant was not found");
  }

  const job = await getJobBySlug(db, tenantId, slug);

  if (!job) {
    notFound();
  }

  const descriptionHtml = sanitizeJobDescriptionHtml(job.descriptionHtml);
  const jsonLd = buildJobPostingJsonLd(job, requestOrigin(await headers()));
  const normalizedTitle = job.title.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const matchingHubs = HUB_ROLE_SLUGS.filter((role) =>
    role.split("-").every((term) => normalizedTitle.includes(term)),
  );

  return (
    <main>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c"),
        }}
        type="application/ld+json"
      />

      <header>
        <Link href="/jobs">All jobs</Link>
        <h1>{job.title}</h1>
        <p>
          <Link href={`/companies/${job.companySlug}`}>{job.companyName}</Link>
          {" · "}
          {job.remote}
          {job.location ? ` · ${job.location}` : ""}
        </p>
        {job.salaryText ? <p>{job.salaryText}</p> : null}
        {showBadge(job.exclusivity) ? (
          <p title={LINKEDIN_EXCLUSIVITY_TOOLTIP}>Not on LinkedIn</p>
        ) : null}
      </header>

      <section aria-labelledby="job-description">
        <h2 id="job-description">Job description</h2>
        <div dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
      </section>

      {matchingHubs.length > 0 ? (
        <nav aria-label="Related job hubs">
          {matchingHubs.map((role) => (
            <span key={role}>
              <Link href={`/remote-${role}-jobs`}>
                Remote {hubSlugLabel(role)} jobs
              </Link>
              {" · "}
              <Link href={`/skills/${role}`}>{hubSlugLabel(role)} skill jobs</Link>
            </span>
          ))}
        </nav>
      ) : null}

      <form action="/api/unlock" method="post">
        <input name="jobId" type="hidden" value={job.id} />
        <button type="submit">Unlock application link</button>
      </form>
    </main>
  );
}
