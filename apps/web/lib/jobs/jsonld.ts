import { sanitizeJobDescriptionHtml } from "./sanitize-description";
import { jobApplyHref, jobPublicHref } from "./queries";

export interface JobPostingJsonLdInput {
  slug: string;
  externalId?: string | null;
  title: string;
  descriptionHtml: string;
  companyName: string;
  postedAt?: string | null;
  location?: string | null;
  remote?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryText?: string | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
  hideSalary?: number | boolean;
  companyLogoUrl?: string | null;
}

/** How long a listing is treated as live when the source gives no expiry - Google drops
 * postings it considers stale after ~30 days with no validThrough, so this is a deliberately
 * conservative window rather than a claim about the real application deadline. */
const VALID_THROUGH_DAYS = 60;

/** Numeric salary rows carry no currency column (see queries.ts) - USD is this board's
 * default listing currency and is only applied when a real min/max number exists. */
const DEFAULT_SALARY_CURRENCY = "USD";

/** The crawler stores postedAt in whatever format the source feed used (some rows are RFC 2822,
 * not ISO 8601) - Google's structured data testing tool requires ISO 8601, so every date this
 * module emits is normalized through here rather than passed through verbatim. */
function toIsoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function buildValidThrough(postedAtIso: string | undefined): string | undefined {
  if (!postedAtIso) return undefined;
  const posted = new Date(postedAtIso);
  return new Date(posted.getTime() + VALID_THROUGH_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

interface JobLocationFields {
  jobLocation?: {
    "@type": "Place";
    address: { "@type": "PostalAddress"; addressLocality: string };
  };
  jobLocationType?: "TELECOMMUTE";
  applicantLocationRequirements?: { "@type": "Country"; name: string };
}

/**
 * jobLocation for a real address when we have one, jobLocationType TELECOMMUTE plus
 * applicantLocationRequirements when the role is remote (both required by Google for
 * telecommute postings), or neither when we truly have nothing to report.
 */
function buildJobLocationFields(job: JobPostingJsonLdInput): JobLocationFields {
  const fields: JobLocationFields = {};

  if (job.location) {
    fields.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.location,
      },
    };
  }

  if (job.remote === "remote") {
    fields.jobLocationType = "TELECOMMUTE";
    fields.applicantLocationRequirements = {
      "@type": "Country",
      name: job.location || "Worldwide",
    };
  }

  return fields;
}

interface SalaryQuantitativeValue {
  "@type": "QuantitativeValue";
  unitText: string;
  minValue?: number;
  maxValue?: number;
}

interface BaseSalaryField {
  baseSalary?: {
    "@type": "MonetaryAmount";
    currency: string;
    value: SalaryQuantitativeValue;
  };
}

function buildBaseSalaryField(job: JobPostingJsonLdInput): BaseSalaryField {
  if(job.hideSalary)return {};
  if (job.salaryMin == null && job.salaryMax == null) return {};
  const value: SalaryQuantitativeValue = { "@type": "QuantitativeValue", unitText: job.salaryPeriod==='monthly'?'MONTH':job.salaryPeriod==='hourly'?'HOUR':'YEAR' };
  if (job.salaryMin != null) value.minValue = job.salaryMin;
  if (job.salaryMax != null) value.maxValue = job.salaryMax;
  return {
    baseSalary: {
      "@type": "MonetaryAmount",
      currency: job.salaryCurrency || DEFAULT_SALARY_CURRENCY,
      value,
    },
  };
}

export function buildJobPostingJsonLd(job: JobPostingJsonLdInput, origin: string) {
  const path = jobPublicHref({
    slug: job.slug,
    externalId: job.externalId ?? null,
  });
  const applyPath = jobApplyHref({
    slug: job.slug,
    externalId: job.externalId ?? null,
  });
  const datePosted = toIsoDate(job.postedAt);
  const validThrough = buildValidThrough(datePosted);

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: sanitizeJobDescriptionHtml(job.descriptionHtml),
    url: new URL(path, origin).toString(),
    hiringOrganization: {
      "@type": "Organization",
      name: job.companyName,
      ...(job.companyLogoUrl ? { logo: job.companyLogoUrl } : {}),
    },
    ...(datePosted ? { datePosted } : {}),
    ...(validThrough ? { validThrough } : {}),
    ...buildJobLocationFields(job),
    ...buildBaseSalaryField(job),
    directApply: true,
    potentialAction: {
      "@type": "ApplyAction",
      target: new URL(applyPath, origin).toString(),
    },
  };
}
