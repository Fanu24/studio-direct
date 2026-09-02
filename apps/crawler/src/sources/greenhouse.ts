import type { JobDraft } from "@gaming/shared";

import { fetchPublicText } from "../http/public-fetch";

const PRODUCT_USER_AGENT =
  "StudioDirectBot/1.0 (+https://studio-direct.example/bot; jobs@studio-direct.example)";

interface GreenhouseJob {
  absolute_url: string;
  id: number;
  updated_at?: string;
  title: string;
  location?: {
    name?: string;
  };
  content?: string;
}

interface GreenhouseBoard {
  jobs: GreenhouseJob[];
}

export function greenhouseBoardUrl(atsSlug: string): string {
  return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(atsSlug)}/jobs?content=true`;
}

function remoteType(location: string | null): JobDraft["remote"] {
  if (location === null) {
    return "unknown";
  }

  return /\b(remote|distributed)\b/i.test(location) ? "remote" : "onsite";
}

export function parseGreenhouseBoard(
  body: string,
  companyName: string,
): JobDraft[] {
  const board = JSON.parse(body) as GreenhouseBoard;

  if (!Array.isArray(board.jobs)) {
    throw new Error("Invalid Greenhouse board response");
  }

  return board.jobs.map((job) => {
    const location = job.location?.name?.trim() || null;

    return {
      source: "career_page",
      sourceUrl: job.absolute_url,
      companyName,
      title: job.title,
      location,
      remote: remoteType(location),
      descriptionHtml: job.content ?? "",
      applyUrl: job.absolute_url,
      postedAt: job.updated_at ?? null,
      rawJson: JSON.stringify(job),
    };
  });
}

export async function fetchGreenhouseBoard(
  atsSlug: string,
  companyName: string,
  fetchImpl: typeof fetch,
): Promise<JobDraft[]> {
  const response = await fetchPublicText(
    greenhouseBoardUrl(atsSlug),
    fetchImpl,
    PRODUCT_USER_AGENT,
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Greenhouse board request failed with status ${response.status}`);
  }

  return parseGreenhouseBoard(response.body, companyName);
}
