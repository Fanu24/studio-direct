import {createSiteReader,type JobDraft,type JobSource,type QueueMessage} from "@gaming/shared";

import { fetchGreenhouseBoard } from "./greenhouse";
import { parseJobPostingJsonLd } from "./jsonld";
import { fetchLeverPostings } from "./lever";
import { fetchAshbyPostings } from './ashby';
import {RateLimitedError,parseRetryAfter} from '../http/public-fetch';

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

    if(company.ats_type==='ashby'){
      if(!company.ats_slug)throw new Error(`Ashby company has no ATS slug: ${company.id}`);
      return fetchAshbyPostings(company.ats_slug,company.name,this.fetchImpl);
    }
    if (company.ats_type !== null) {
      throw new Error(`Unsupported career ATS type: ${company.ats_type}`);
    }

    if (!company.career_url) {
      throw new Error(`Company has no career URL: ${company.id}`);
    }

    const response = await createSiteReader(async(input,init)=>{
      const result=await this.fetchImpl(input,init);
      if(result.status===403||result.status===429)throw new RateLimitedError(result.status,parseRetryAfter(result.headers.get('Retry-After')));
      return result;
    }).read(company.career_url);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Career page request failed with status ${response.status}`,
      );
    }

    const drafts = parseJobPostingJsonLd(
      response.body,
      company.name,
      company.career_url,
    );
    // An empty HTML extraction can mean a JS page or changed markup, not zero vacancies.
    if(!drafts.length)throw new Error('No JobPosting data found; retain existing listings for review');
    return drafts;
  }
}
