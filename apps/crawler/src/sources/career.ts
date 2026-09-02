import type { JobDraft, JobSource, QueueMessage } from "@gaming/shared";

import { fetchPublicText } from "../http/public-fetch";
import { fetchGreenhouseBoard } from "./greenhouse";
import { parseJobPostingJsonLd } from "./jsonld";
import { fetchLeverPostings } from "./lever";

const PRODUCT_USER_AGENT =
  "StudioDirectBot/1.0 (+https://studio-direct.example/bot; jobs@studio-direct.example)";

export interface CareerCompany {
  id: string;
  name: string;
  ats_type: string | null;
  ats_slug: string | null;
  career_url?: string | null;
}

export interface CareerCompanyRepo {
  getById(id: string): Promise<CareerCompany | null>;
}

export class CareerJobSource implements JobSource {
  constructor(
    private readonly companyRepo: CareerCompanyRepo,
    private readonly fetchImpl: typeof fetch,
  ) {}

  async fetch(message: QueueMessage): Promise<JobDraft[]> {
    if (message.kind !== "career") {
      throw new Error(`CareerJobSource cannot handle ${message.kind} messages`);
    }

    const company = await this.companyRepo.getById(message.companyId);
    if (company === null) {
      throw new Error(`Company not found: ${message.companyId}`);
    }

    if (company.ats_type === "greenhouse") {
      if (!company.ats_slug) {
        throw new Error(`Greenhouse company has no ATS slug: ${company.id}`);
      }

      return fetchGreenhouseBoard(
        company.ats_slug,
        company.name,
        this.fetchImpl,
      );
    }

    if (company.ats_type === "lever") {
      if (!company.ats_slug) {
        throw new Error(`Lever company has no ATS slug: ${company.id}`);
      }

      return fetchLeverPostings(
        company.ats_slug,
        company.name,
        this.fetchImpl,
      );
    }

    if (company.ats_type !== null) {
      throw new Error(`Unsupported career ATS type: ${company.ats_type}`);
    }

    if (!company.career_url) {
      throw new Error(`Company has no career URL: ${company.id}`);
    }

    const response = await fetchPublicText(
      company.career_url,
      this.fetchImpl,
      PRODUCT_USER_AGENT,
    );

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Career page request failed with status ${response.status}`,
      );
    }

    return parseJobPostingJsonLd(
      response.body,
      company.name,
      company.career_url,
    );
  }
}
