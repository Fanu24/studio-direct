import { apiTagParam, parseWeb3CareerApiPayload, type JobDraft } from "@gaming/shared";

export const WEB3_CAREER_API_URL = "https://web3.career/api/v1";

/**
 * The endpoint sits behind Cloudflare bot protection that refuses a request with no
 * browser-shaped User-Agent, returning 403 "Error 1010" before the token is even read.
 * Verified against the live API: identical URL and token, 403 without this header and 200
 * with it. So this is required for the importer to work at all, not a disguise — the
 * request is still authenticated with our own API token.
 */
export const WEB3_CAREER_USER_AGENT =
  "Mozilla/5.0 (compatible; NodeworkBot/1.0; +https://nodework.app/about) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type Web3ApiQuery = {
  tag?: string;
  country?: string;
  remote?: boolean;
  limit?: number;
};

export class Web3CareerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "Web3CareerApiError";
  }
}

export async function fetchWeb3CareerJobs(
  token: string,
  query: Web3ApiQuery,
  fetcher: typeof fetch = fetch,
): Promise<JobDraft[]> {
  const url = new URL(WEB3_CAREER_API_URL);
  url.searchParams.set("token", token);
  url.searchParams.set("limit", String(query.limit ?? 100));
  url.searchParams.set("show_description", "true");
  if (query.tag) url.searchParams.set("tag", apiTagParam(query.tag));
  if (query.country) url.searchParams.set("country", query.country);
  if (query.remote) url.searchParams.set("remote", "true");

  const response = await fetcher(url.toString(), {
    headers: { accept: "application/json", "user-agent": WEB3_CAREER_USER_AGENT },
  });

  if (response.status === 429 || response.status === 401 || response.status === 403) {
    throw new Web3CareerApiError(`Web3 Career API ${response.status}`, response.status);
  }
  if (!response.ok) {
    throw new Web3CareerApiError(`Web3 Career API ${response.status}`, response.status);
  }

  const payload: unknown = await response.json();
  return parseWeb3CareerApiPayload(payload);
}
