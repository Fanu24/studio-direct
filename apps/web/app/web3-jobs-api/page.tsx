import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon } from "../_components/icons";
import { JsonLd } from "../_components/json-ld";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = {
  title: "Web3 jobs API access",
  description:
    "Free Nodework jobs API: JSON and RSS, revocable API keys, job filters, full descriptions and pagination.",
  alternates: { canonical: "/web3-jobs-api" },
};

const RESPONSE_FIELDS = [
  { field: "apply_url", desc: "Public URL of the listing on Nodework." },
  { field: "description", desc: "HTML job description when show_description=true." },
  { field: "id", desc: "Internal job id." },
  { field: "slug", desc: "SEO slug used in the public job URL." },
  { field: "externalId", desc: "Source id from the feed this job was imported from, when it has one." },
  { field: "title", desc: "Job title as published by the employer." },
  { field: "companyName", desc: "Hiring company name." },
  { field: "companySlug", desc: "Company slug, used in /web3-companies/:slug." },
  { field: "companyLogoUrl", desc: "Logo URL from the source feed, when one was provided." },
  { field: "location", desc: "Free-text location as published, or null." },
  { field: "remote", desc: "Remote, hybrid, onsite or unknown, as stated in the listing." },
  { field: "salaryText", desc: "Salary as published in free text, when the source gave one." },
  { field: "salaryMin", desc: "Parsed minimum salary bound, or null." },
  { field: "salaryMax", desc: "Parsed maximum salary bound, or null." },
  { field: "postedAt", desc: "ISO timestamp the job was first seen, or null." },
  { field: "tags", desc: "Array of tag slugs, matching the /:tag-jobs pages." },
];

const QUERY_PARAMS = [
  { param: "show_description", desc: "true to include the full HTML description; false by default." },
  { param: "country", desc: "Country slug; location also accepts city and region slugs." },
  { param: "tag", desc: "One tag slug, e.g. solidity or defi. Matches the /:tag-jobs pages." },
  { param: "location", desc: "A city slug from the location pages, e.g. new-york." },
  { param: "remote", desc: "true or 1 to only return jobs flagged remote." },
  { param: "seniority", desc: "Free-text match against the job title, e.g. senior or intern." },
  { param: "crypto_payment", desc: "Set to 1 to return jobs offering payment in crypto." },
  { param: "salary_min", desc: "Only return jobs whose annual salary maximum in USD is at least this value." },
  { param: "salary_max", desc: "Only return jobs whose annual salary minimum in USD is at most this value." },
  { param: "page", desc: "1-based page number. Defaults to 1." },
  { param: "page_size", desc: "Results per page: 1–100, default 20. Also accepts limit." },
];

const SAMPLE_RESPONSE = `{
  "page": 1,
  "pageSize": 20,
  "total": 431,
  "jobs": [
    {
      "id": "job_8f2c1e",
      "slug": "senior-solidity-engineer-acme-labs",
      "externalId": "w3c_88213",
      "title": "Senior Solidity Engineer",
      "companyName": "Acme Labs",
      "companySlug": "acme-labs",
      "companyLogoUrl": "https://cdn.example.com/logos/acme-labs.png",
      "location": "Remote",
      "remote": "remote",
      "apply_url": "https://YOUR_DOMAIN/jobs/senior-solidity-engineer-acme-labs",
      "salaryText": "$140k - $190k",
      "salaryMin": 140000,
      "salaryMax": 190000,
      "postedAt": "2026-08-14T09:00:00.000Z",
      "tags": ["solidity", "evm", "senior"]
    }
  ]
}`;

const FAQ = [
  {
    question: "Is the API live today?",
    answer:
      "Yes. Sign in with a verified email and generate a key to request the current public catalog. There is no API subscription charge.",
  },
  {
    question: "What are the usage limits?",
    answer:
      "Each key allows 60 requests per minute and up to 100 results per response. A 429 response includes Retry-After. Use page for subsequent results.",
  },
  {
    question: "How do I get or revoke a key?",
    answer:
      "Sign in, open API keys and enter the website where you will use the feed. Copy the new key once; only its hash is stored. Revoke it from the same page if needed.",
  },
  {
    question: "Does the API include candidate data?",
    answer:
      "No. The jobs API returns public listings only. Candidate profiles, contact details and CVs are not part of this API.",
  },
];

function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export default function Web3JobsApiPage() {
  return (
    <main className="surface surface--stage marketing web3-jobs-api">
      <JsonLd data={faqJsonLd()} />

      <div className="container container--content">
        {PageHeader({
          kicker: "Data access",
          title: "Web3 jobs API access",
          lead: "The same job catalog that powers search and the tag, location and salary pages on Nodework, available as JSON and RSS for integrations.",
        })}
      </div>

      <section aria-labelledby="api-status" className="marketing-section">
        <div className="container container--content stack">
          <h2 id="api-status">Where this stands today</h2>
          <div className="marketing-notice"><p>Generate a free API key, then send it using the Authorization: Bearer header. JSON: /api/v1 or /api/v1/jobs. RSS: /api/v1.xml. A token query parameter is also supported for feed readers; keep these URLs private.</p></div>
        </div>
      </section>

      <section aria-labelledby="api-endpoint" className="band marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">Read-only API</span>
            <h2 id="api-endpoint">Endpoint and filters</h2>
            <p>
              One read endpoint returning paginated jobs, filtered the same way the job
              board itself is: by tag, location, remote flag, seniority text match and
              salary bounds. Every job already carries a annual salary minimum in USD and salaryMax,
              so range filtering is a real field, not a future addition.
            </p>
          </div>

          <p className="marketing-endpoint">
            <span className="marketing-endpoint__method">GET</span>
            <code className="marketing-endpoint__path">/api/v1/jobs</code>
          </p>

          <pre className="panel panel--well marketing-code">{'curl -H "Authorization: Bearer YOUR_API_KEY" "https://YOUR_DOMAIN/api/v1?tag=solidity&remote=true&limit=5&show_description=true"'}</pre>
          <div className="marketing-table-wrap">
            <table className="marketing-table">
              <thead>
                <tr>
                  <th scope="col">Parameter</th>
                  <th scope="col">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {QUERY_PARAMS.map((row) => (
                  <tr key={row.param}>
                    <td>{row.param}</td>
                    <td className="marketing-table__desc">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="api-response" className="marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">Response</span>
            <h2 id="api-response">Example response</h2>
            <p>Field names match the job records the board already renders, one job shown for brevity.</p>
          </div>
          <pre className="panel panel--well marketing-code">{SAMPLE_RESPONSE}</pre>

          <div className="marketing-table-wrap">
            <table className="marketing-table">
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {RESPONSE_FIELDS.map((row) => (
                  <tr key={row.field}>
                    <td>{row.field}</td>
                    <td className="marketing-table__desc">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="api-access" className="band marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">Access</span>
            <h2 id="api-access">Get your API key</h2>
            <p>
              Sign in with a verified email to generate and revoke keys. API access is free.
              Each key is limited to 60 requests per minute and each response to 100 jobs.
            </p>
          </div>
          <div className="cluster">
            <Link className="button button--primary" href="/api-access">
              Manage API keys
            </Link>
            <Link className="text-link" href="/jobs">
              Browse the catalog first
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="api-faq" className="marketing-section">
        <div className="container container--content">
          <div className="section-head">
            <h2 id="api-faq">Questions</h2>
          </div>
          <dl className="about-faq__list">
            {FAQ.map((item) => (
              <div className="about-faq__item" key={item.question}>
                <dt>{item.question}</dt>
                <dd>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="api-close" className="marketing-section">
        <div className="container container--content price-close">
          <p>
            Every field above already exists on jobs shown at <Link href="/jobs">/jobs</Link>.
          </p>
          <div className="cluster">
            <Link className="button button--ghost" href="/about">
              How Nodework works
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
