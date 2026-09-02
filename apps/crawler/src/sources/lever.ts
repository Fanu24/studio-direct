import type { JobDraft } from "@gaming/shared";

import { fetchPublicText } from "../http/public-fetch";

const PRODUCT_USER_AGENT =
  "StudioDirectBot/1.0 (+https://studio-direct.example/bot; jobs@studio-direct.example)";

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl: string;
  createdAt?: number;
  workplaceType?: "unspecified" | "on-site" | "remote" | "hybrid";
  categories?: {
    location?: string;
  };
  description?: string;
}

export function leverPostingsUrl(atsSlug: string): string {
  return `https://api.lever.co/v0/postings/${encodeURIComponent(atsSlug)}?mode=json`;
}

function remoteType(
  location: string | null,
  workplaceType: LeverPosting["workplaceType"],
): JobDraft["remote"] {
  if (workplaceType === "remote" || workplaceType === "hybrid") {
    return workplaceType;
  }

  if (workplaceType === "on-site") {
    return "onsite";
  }

  if (workplaceType !== undefined && workplaceType !== "unspecified") {
    return "unknown";
  }

  if (location === null) {
    return "unknown";
  }

  return /\b(remote|distributed)\b/i.test(location) ? "remote" : "onsite";
}

export function parseLeverPostings(
  body: string,
  companyName: string,
): JobDraft[] {
  const postings = JSON.parse(body) as LeverPosting[];

  if (!Array.isArray(postings)) {
    throw new Error("Invalid Lever postings response");
  }

  return postings.map((posting) => {
    const location = posting.categories?.location?.trim() || null;

    return {
      source: "career_page",
      sourceUrl: posting.hostedUrl,
      companyName,
      title: posting.text,
      location,
      remote: remoteType(location, posting.workplaceType),
      descriptionHtml: posting.description ?? "",
      applyUrl: posting.applyUrl,
      postedAt:
        typeof posting.createdAt === "number"
          ? new Date(posting.createdAt).toISOString()
          : null,
      rawJson: JSON.stringify(posting),
    };
  });
}

export async function fetchLeverPostings(
  atsSlug: string,
  companyName: string,
  fetchImpl: typeof fetch,
): Promise<JobDraft[]> {
  const response = await fetchPublicText(
    leverPostingsUrl(atsSlug),
    fetchImpl,
    PRODUCT_USER_AGENT,
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Lever postings request failed with status ${response.status}`);
  }

  return parseLeverPostings(response.body, companyName);
}
