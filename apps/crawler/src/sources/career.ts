import type { JobDraft, JobSource, QueueMessage } from "@gaming/shared";

import { fetchGreenhouseBoard } from "./greenhouse";

export interface CareerCompany {
  id: string;
  name: string;
  ats_type: string | null;
  ats_slug: string | null;
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

    throw new Error(`Unsupported career ATS type: ${company.ats_type ?? "none"}`);
  }
}
