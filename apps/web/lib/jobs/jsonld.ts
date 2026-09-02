import { sanitizeJobDescriptionHtml } from "./sanitize-description";

export interface JobPostingJsonLdInput {
  slug: string;
  title: string;
  descriptionHtml: string;
  companyName: string;
}

/**
 * The apply URL is deliberately absent. It is gated behind an unlock, and anything placed here
 * ships in the page source to anonymous visitors. `url` points at the Studio Direct job page,
 * which is the page we want indexed and the page that carries the unlock control.
 */
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
    directApply: false,
  };
}
