import {createSiteReader,extractLinks,type JobDraft,type JobSource,type QueueMessage} from "@gaming/shared";

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

    const reader = createSiteReader(async(input,init)=>{
      const result=await this.fetchImpl(input,init);
      if(result.status===403||result.status===429)throw new RateLimitedError(result.status,parseRetryAfter(result.headers.get('Retry-After')));
      return result;
    });
    const response = await reader.read(company.career_url);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Career page request failed with status ${response.status}`,
      );
    }

    const drafts = parseJobPostingJsonLd(
      response.body,
      company.name,
      response.url,
    );
    if(!drafts.length){
      const root=new URL(response.url);
      const links=extractLinks(response.body,response.url).filter(link=>{
        const url=new URL(link.url);
        return url.origin===root.origin&&url.href!==root.href&&/(?:careers?|jobs?|positions?|openings?|vacancies)\/.+/i.test(url.pathname)&&!/(?:login|privacy|terms|subscribe|search)/i.test(url.pathname);
      });
      // A partial snapshot must never close vacancies not reached by this crawl.
      if(links.length>25)throw new Error('Career index exceeds 25 detail pages; configure a dedicated adapter');
      for(const link of links){
        const page=await reader.read(link.url);
        const parsed=parseJobPostingJsonLd(page.body,company.name,page.url);
        if(!parsed.length)throw new Error('Career detail lacks JobPosting data; retain existing listings for review');
        drafts.push(...parsed);
      }
    }
    // An empty HTML extraction can mean a JS page or changed markup, not zero vacancies.
    if(!drafts.length)throw new Error('No JobPosting data found; retain existing listings for review');
    return [...new Map(drafts.map(draft=>[draft.applyUrl,draft])).values()];
  }
}
