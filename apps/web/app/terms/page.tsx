import type { Metadata } from "next";

import { TERMS_COPY } from "../../lib/legal/copy";

export const metadata: Metadata = {
  title: "Terms of Service | Studio Direct",
  description:
    "Listings come from third parties and may be incomplete. We do not provide real-time LinkedIn coverage.",
};

export default function TermsPage() {
  return (
    <main className="stack">
      <h1>{TERMS_COPY.title}</h1>
      <p>{TERMS_COPY.legalEntity}</p>
      <p>{TERMS_COPY.thirdParties}</p>
      <p>{TERMS_COPY.incomplete}</p>
      <p>{TERMS_COPY.noRealtimeLinkedIn}</p>
      <p>
        A “Not on LinkedIn” badge means: {TERMS_COPY.badgeMeaning}
      </p>
    </main>
  );
}
