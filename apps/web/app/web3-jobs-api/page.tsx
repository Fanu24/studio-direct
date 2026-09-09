import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon, LockIcon } from "../_components/icons";
import { JsonLd } from "../_components/json-ld";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = {
  title: "Web3 jobs API access",
  description:
    "How the Nodework jobs API will work: endpoint shape, filters for tag, location, remote and salary, an example response, and how to request early access.",
  alternates: { canonical: "/web3-jobs-api" },
};

const RESPONSE_FIELDS = [
  { field: "id", desc: "Internal job id." },
  { field: "slug", desc: "SEO slug used in the public job URL." },
  { field: "externalId", desc: "Source id from the feed this job was imported from, when it has one." },
  { field: "title", desc: "Job title as published by the employer." },
  { field: "companyName", desc: "Hiring company name." },
  { field: "companySlug", desc: "Company slug, used in /web3-companies/:slug." },
  { field: "companyLogoUrl", desc: "Logo URL from the source feed, when one was provided." },
  { field: "location", desc: "Free-text location as published, or null." },
  { field: "remote", desc: "\"remote\" or \"unknown\", set from the source listing." },
  { field: "salaryText", desc: "Salary as published in free text, when the source gave one." },
  { field: "salaryMin", desc: "Parsed minimum salary bound, or null." },
  { field: "salaryMax", desc: "Parsed maximum salary bound, or null." },
  { field: "postedAt", desc: "ISO timestamp the job was first seen, or null." },
  { field: "tags", desc: "Array of tag slugs, matching the /:tag-jobs pages." },
];

const QUERY_PARAMS = [
  { param: "tag", desc: "One tag slug, e.g. solidity or defi. Matches the /:tag-jobs pages." },
  { param: "location", desc: "A city slug from the location pages, e.g. new-york." },
  { param: "remote", desc: "1 to only return jobs flagged remote." },
  { param: "seniority", desc: "Free-text match against the job title, e.g. senior or intern." },
  { param: "salary_min", desc: "Only return jobs whose parsed salaryMax is at least this value." },
  { param: "salary_max", desc: "Only return jobs whose parsed salaryMin is at most this value." },
  { param: "page", desc: "1-based page number. Defaults to 1." },
  { param: "page_size", desc: "Results per page. Will ship with a fixed maximum." },
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
      "No. This page documents the response shape and filters we are building the API around, matched to the job model already running the site. There is no public endpoint yet.",
  },
  {
    question: "Will the field names change before launch?",
    answer:
      "The response fields map directly to the job records Nodework already stores, so the shape above is stable. What is still open is authentication, rate limits, and pagination limits.",
  },
  {
    question: "How do I get access when it ships?",
    answer:
      "Create a free Nodework account. There is no separate API waitlist form yet, so accounts are how we will identify who to email when keys open.",
  },
  {
    question: "Can I scrape /jobs instead of waiting?",
    answer:
      "Please do not. Use the account route below and we will let you know when there is a supported way in.",
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
    <main className="marketing web3-jobs-api">
      <JsonLd data={faqJsonLd()} />

      <div className="container container--content">
        {PageHeader({
          kicker: "Data access",
          title: "Web3 jobs API access",
          lead: "The same job catalog that powers search and the tag, location and salary pages on Nodework, documented as a JSON API so partners can plan an integration before it opens.",
        })}
      </div>

      <section aria-labelledby="api-status" className="marketing-section">
        <div className="container container--content stack">
          <h2 id="api-status">Where this stands today</h2>
          <div className="marketing-notice">
            <LockIcon size={18} />
            <p>
              There is no public API endpoint live yet. The shape below matches the job
              records already stored for the web board, so it will not change out from
              under an integration once access opens. Treat this as a preview of the
              contract, not a live service.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="api-endpoint" className="band marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">Planned shape</span>
            <h2 id="api-endpoint">Endpoint and filters</h2>
            <p>
              One read endpoint returning paginated jobs, filtered the same way the job
              board itself is: by tag, location, remote flag, seniority text match and
              salary bounds. Every job already carries a parsed salaryMin and salaryMax,
              so range filtering is a real field, not a future addition.
            </p>
          </div>

          <p className="marketing-endpoint">
            <span className="marketing-endpoint__method">GET</span>
            <code className="marketing-endpoint__path">/api/v1/jobs</code>
          </p>

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
          <pre className="marketing-code">{SAMPLE_RESPONSE}</pre>

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
            <h2 id="api-access">Request early access</h2>
            <p>
              Rate limits and authentication are not finalized, so we are not opening keys
              to the public yet. Access is by request while that work lands, and it will
              stay free to read the same public jobs anyone can already see on the board.
            </p>
          </div>
          <div className="cluster">
            <Link className="button button--lg" href="/login">
              Create a free account
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
            <Link className="button button--secondary" href="/about">
              How Nodework works
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
