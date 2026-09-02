import { sanitizeJobDescriptionHtml } from "./sanitize-description";

export interface JobPostingJsonLdInput {
  slug: string;
  title: string;
  descriptionHtml: string;
  companyName: string;
}

export function buildJobPostingJsonLd(job: JobPostingJsonLdInput, origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: sanitizeJobDescriptionHtml(job.descriptionHtml),
    url: new URL(`/jobs/${encodeURIComponent(job.slug)}`, origin).toString(),
    hiringOrganization: {
      "@type": "Organization",
      name: job.companyName,
    },
  };
}
