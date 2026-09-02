export interface JobPostingJsonLdInput {
  slug: string;
  title: string;
  descriptionHtml: string;
  applyUrl: string;
  companyName: string;
}

export function buildJobPostingJsonLd(job: JobPostingJsonLdInput, origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.descriptionHtml,
    url: new URL(`/jobs/${encodeURIComponent(job.slug)}`, origin).toString(),
    hiringOrganization: {
      "@type": "Organization",
      name: job.companyName,
    },
    directApply: {
      "@type": "ApplyAction",
      target: job.applyUrl,
    },
  };
}
