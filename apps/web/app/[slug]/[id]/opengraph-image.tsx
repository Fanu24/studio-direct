import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ImageResponse } from "next/og";

import { remoteLabel } from "../../_components/job-card";
import { getJobByExternalId, type JobsDatabase } from "../../../lib/jobs/queries";
import { requireTenantId } from "../../../lib/tenant";

export const alt = "Job posting on Nodework";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type JobParams = Promise<{ slug: string; id: string }>;

function companyMark(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? "?"}${parts[1]?.[0] ?? ""}`;
  return letters.toUpperCase();
}

export default async function Image({ params }: { params: JobParams }) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);
  const job = await getJobByExternalId(db, tenantId, id);

  const title = job?.title ?? "Job opening";
  const company = job?.companyName ?? "Nodework";
  const place = job ? job.location || remoteLabel(job.remote) : "";
  const salary = job?.salaryText ?? "";
  const facts = [place, salary].filter(Boolean).join("  ·  ");

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "64px 72px",
          background: "#000000",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 12,
              background: "#0a0a0a",
              border: "1px solid #2a2a2a",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {companyMark(company)}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#b8b8b8" }}>{company}</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 60,
              fontWeight: 700,
              lineHeight: 1.15,
              color: "#ffffff",
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          {facts ? (
            <div style={{ display: "flex", fontSize: 30, color: "#ff2d87" }}>{facts}</div>
          ) : null}
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#b8b8b8" }}>Nodework</div>
      </div>
    ),
    { ...size },
  );
}
