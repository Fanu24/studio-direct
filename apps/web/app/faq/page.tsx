import { careerFaq, type FaqStats } from "@gaming/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import Link from "next/link";

import { ArticleLayout } from "../_components/article-layout";
import { JsonLd } from "../_components/json-ld";
import { listJobs, type JobsDatabase } from "../../lib/jobs/queries";
import { requireTenantId } from "../../lib/tenant";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Answers about Web3 careers and Nodework: how the stack works, how to apply, which skills show up in listings, and how salary pages are built.",
  alternates: { canonical: "/faq" },
};

// Read live D1 data at request time; builds must not depend on a local database.
export const dynamic = "force-dynamic";

function faqAnchor(question: string) {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function loadFaqStats(): Promise<FaqStats | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as CloudflareEnv & { DB: JobsDatabase }).DB;
    const tenantId = await requireTenantId(db);
    const [listed, remote, nyc] = await Promise.all([
      listJobs(db, tenantId, { pageSize: 1 }),
      listJobs(db, tenantId, { remoteOnly: true, pageSize: 1 }),
      listJobs(db, tenantId, { locationSlug: "new-york", pageSize: 1 }),
    ]);
    return {
      jobCount: listed.total,
      placeSummary: `On Nodework, remote listings currently number ${remote.total}. New York currently has ${nyc.total} listed roles in this catalog. United States and European cities show up often, alongside Singapore, London, and other crypto centers. A quiet city page is not proof that local teams stopped hiring.`,
    };
  } catch {
    return undefined;
  }
}

export default async function FaqPage() {
  const faq = careerFaq(await loadFaqStats());
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <ArticleLayout
        lead="Career questions people bring to a Web3 job board, answered in Nodework terms. Legal wording lives on the terms and privacy pages."
        related={
          <p className="cluster" style={{ marginTop: 32 }}>
            <Link className="text-link" href="/jobs">
              Browse jobs
            </Link>
            <Link className="text-link" href="/what-is-web3">
              What is Web3
            </Link>
            <Link className="text-link" href="/learn-web3">
              Learn Web3
            </Link>
            <Link className="text-link" href="/hire">
              Hire
            </Link>
          </p>
        }
        title="Frequently Asked Questions"
        toc={faq.map((item) => ({
          href: `#${faqAnchor(item.question)}`,
          label: item.question,
        }))}
      >
        {faq.map((item) => (
          <section className="faq-qa" id={faqAnchor(item.question)} key={item.question}>
            <h2 className="faq-qa__question">{item.question}</h2>
            <p className="faq-qa__answer">{item.answer}</p>
          </section>
        ))}
      </ArticleLayout>
    </>
  );
}
