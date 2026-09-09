import {
  type CitySlug,
  countryForCity,
  landingPath,
  regionForCity,
  tagLabel,
} from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";

import { TABLE_HEADING_STYLE } from "../_components/table-heading";
import { listLocationJobCounts, type JobsDatabase } from "../../lib/jobs/queries";
import { requireTenantId } from "../../lib/tenant";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Top web3 cities in the world",
  description:
    "Every city with a live Web3, blockchain or crypto job on Nodework, ranked by open roles and linked to its country and region.",
  alternates: { canonical: "/web3-cities" },
};

function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function introSentence(rows: { slug: string; jobCount: number }[]): string {
  if (rows.length === 0) {
    return "No city has a live Web3 role right now. Check back as the catalog grows.";
  }

  const top = rows.slice(0, 3);
  const names = joinNames(top.map((row) => tagLabel(row.slug)));
  const verb = top.length === 1 ? "leads" : "lead";
  const remainder = rows.length - top.length;
  const remainderText =
    remainder > 0
      ? `, plus ${formatCount(remainder)} more ${remainder === 1 ? "city" : "cities"} with live roles below`
      : "";

  return `${names} ${verb} the current count${remainderText}.`;
}

export default async function Web3CitiesPage() {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
  const tenantId = await requireTenantId(db);

  const cityRows = await listLocationJobCounts(db, tenantId, "city");

  return (
    <main>
      <header className="page-header">
        <h1>Top web3 cities in the world</h1>
        <p className="lead">{introSentence(cityRows)}</p>
      </header>

      <section className="container jobs-more">
        <h2>Cities ranked by live roles</h2>
        <p>
          Every row links to its city, country, and region landing so you can widen the
          search without leaving the table.
        </p>

        {cityRows.length === 0 ? (
          <div className="empty">
            <p>No city has a live Web3 role right now.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="salary-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>City</th>
                  <th>Country</th>
                  <th>Region</th>
                  <th>Jobs</th>
                </tr>
              </thead>
              {/*
                Each of the three linked cells is a heading, so the outline of
                this page is the directory itself rather than a single section
                title - the same shape the reference city directory uses, where
                city, country and region are all marked up as headings and the
                rank and job-count cells are not.
              */}
              <tbody>
                {cityRows.map((row, index) => {
                  const country = countryForCity(row.slug as CitySlug);
                  const region = regionForCity(row.slug as CitySlug);

                  return (
                    <tr key={row.slug}>
                      <td className="mono">{index + 1}</td>
                      <td>
                        <h2 style={TABLE_HEADING_STYLE}>
                          <Link href={landingPath({ kind: "city", city: row.slug })}>
                            {tagLabel(row.slug)}
                          </Link>
                        </h2>
                      </td>
                      <td>
                        {country ? (
                          <h2 style={TABLE_HEADING_STYLE}>
                            <Link href={landingPath({ kind: "country", country })}>
                              {tagLabel(country)}
                            </Link>
                          </h2>
                        ) : (
                          <span className="muted">Not mapped</span>
                        )}
                      </td>
                      <td>
                        {region ? (
                          <h2 style={TABLE_HEADING_STYLE}>
                            <Link href={landingPath({ kind: "region", region })}>
                              {tagLabel(region)}
                            </Link>
                          </h2>
                        ) : (
                          <span className="muted">Not mapped</span>
                        )}
                      </td>
                      <td className="mono">{formatCount(row.jobCount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
