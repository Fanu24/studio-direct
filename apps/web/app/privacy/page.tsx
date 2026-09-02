import type { Metadata } from "next";

import { PRIVACY_COPY } from "../../lib/legal/copy";

export const metadata: Metadata = {
  title: "Privacy Policy | Studio Direct",
  description:
    "We use data for the job-board product. Recruiter talent-pool sharing is a separate opt-in purpose and is off by default.",
};

export default function PrivacyPage() {
  return (
    <main>
      <h1>{PRIVACY_COPY.title}</h1>
      <p>{PRIVACY_COPY.legalEntity}</p>
      <p>{PRIVACY_COPY.jobProductPurpose}</p>
      <p>{PRIVACY_COPY.recruiterOptInPurpose}</p>
    </main>
  );
}
