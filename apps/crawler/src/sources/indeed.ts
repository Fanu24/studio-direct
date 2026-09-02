import type { JobDraft, QueueMessage } from "@gaming/shared";

import { fetchPublicText } from "../http/public-fetch";
import { parseJobPostingJsonLd } from "./jsonld";

const PRODUCT_USER_AGENT =
  "StudioDirectBot/1.0 (+https://studio-direct.example/bot; jobs@studio-direct.example)";

export function indeedSearchUrl(query: string): string {
  return `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}`;
}

function hiringOrganizationName(rawJson: string): string | null {
  try {
    const posting = JSON.parse(rawJson) as {
      hiringOrganization?: unknown;
    };
    const organization = posting.hiringOrganization;

    if (typeof organization === "string" && organization.trim() !== "") {
      return organization.trim();
    }
    if (
      organization !== null &&
      typeof organization === "object" &&
      "name" in organization
    ) {
      const name = (organization as { name?: unknown }).name;
      return typeof name === "string" && name.trim() !== ""
        ? name.trim()
        : null;
    }
  } catch {
    // The shared parser already excludes malformed JSON-LD.
  }

  return null;
}

export function parseIndeedJobPostingJsonLd(
  html: string,
  pageUrl: string,
): JobDraft[] {
  return parseJobPostingJsonLd(html, "", pageUrl).flatMap((draft) => {
    const companyName = hiringOrganizationName(draft.rawJson);
    return companyName === null
      ? []
      : [{ ...draft, source: "indeed", companyName }];
  });
}

export class IndeedJobSource {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async fetch(
    message: Extract<QueueMessage, { kind: "indeed" }>,
  ): Promise<JobDraft[]> {
    const url = indeedSearchUrl(message.query);
    const response = await fetchPublicText(
      url,
      this.fetchImpl,
      PRODUCT_USER_AGENT,
    );

    return parseIndeedJobPostingJsonLd(response.body, url);
  }
}
