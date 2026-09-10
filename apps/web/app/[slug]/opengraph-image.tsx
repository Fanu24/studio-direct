import { landingHeadline, parseLandingSegment } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ImageResponse } from "next/og";

import { listLandingJobs, type JobsDatabase } from "../../lib/jobs/queries";
import { requireTenantId } from "../../lib/tenant";

export const revalidate = 300;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Nodework. Web3 jobs, salaries and companies.";

async function loadSummary(segment: string) {
  const landing = parseLandingSegment(segment);
  if (!landing) return null;
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);
  // Only the live count is needed for the card - skip the per-row detail
  // fetch the page itself does for JobPosting JSON-LD.
  const result = await listLandingJobs(db, tenantId, landing, 1);
  return { landing, total: result.total };
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const summary = await loadSummary(slug);
  const headline = summary ? landingHeadline(summary.landing) : "Nodework";
  const countLabel = summary ? `${summary.total.toLocaleString("en-US")} jobs live now` : "Web3 jobs";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 80,
          backgroundColor: "#000000",
          backgroundImage: "linear-gradient(160deg, #000000 0%, #1a0410 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              backgroundColor: "#ff2d87",
              marginRight: 16,
              display: "flex",
            }}
          />
          <div style={{ fontSize: 32, letterSpacing: 2, textTransform: "uppercase" }}>
            Nodework
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
            {headline}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 34,
              color: "#ff2d87",
            }}
          >
            {countLabel}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
