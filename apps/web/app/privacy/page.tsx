import type { Metadata } from "next";

import { PRIVACY_COPY } from "../../lib/legal/copy";

export const metadata: Metadata = {
  title: PRIVACY_COPY.title,
  description:
    "Privacy Policy for Studio Direct: we use data for the job-board product. Recruiter talent-pool sharing is a separate opt-in purpose and is off by default.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS = [
  { id: "operator", label: "Who operates this site" },
  { id: "job-board", label: "Job-board product" },
  { id: "talent-pool", label: "Recruiter talent pool" },
] as const;

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <header className="legal-page__head">
        <span className="kicker">Legal</span>
        <h1>{PRIVACY_COPY.title}</h1>
      </header>
      <div className="legal-page__grid">
        <nav aria-label="On this page" className="legal-toc">
          <span className="tag">On this page</span>
          <ol>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.label}</a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="legal-body">
          <section aria-labelledby="operator-title" id="operator">
            <h2 id="operator-title">Who operates this site</h2>
            <p>{PRIVACY_COPY.legalEntity}</p>
          </section>
          <section aria-labelledby="job-board-title" id="job-board">
            <h2 id="job-board-title">Job-board product</h2>
            <p>{PRIVACY_COPY.jobProductPurpose}</p>
          </section>
          <section aria-labelledby="talent-pool-title" id="talent-pool">
            <h2 id="talent-pool-title">Recruiter talent pool</h2>
            <p>{PRIVACY_COPY.recruiterOptInPurpose}</p>
          </section>
        </article>
      </div>
    </main>
  );
}
