import { isCitySlug, tagLabel, type CitySlug } from "@gaming/shared";

export type EventRegion =
  | "North America"
  | "Europe"
  | "Middle East"
  | "Asia-Pacific"
  | "Global";

export type EventCategory =
  | "Developer & protocol"
  | "Trading & exchanges"
  | "Institutional & policy"
  | "NFT & culture"
  | "DeFi & trading"
  | "Bitcoin & adoption"
  | "General tech";

/**
 * A recurring, publicly documented Web3/crypto industry event. This is a curated,
 * hand-maintained list, not a feed. There is no events table in the database. Only
 * long-running annual events are included. `month` is deliberately coarse (a month or
 * a season) because exact dates move year to year and we do not want to publish a date
 * we cannot verify; the official site is always the source of truth for the current
 * edition. `citySlug` is only set when the event has a stable home city that also
 * exists in the CITIES taxonomy, so the card can link to that city's job page.
 * Events that rotate cities each year leave it unset.
 */
export type CryptoEvent = {
  name: string;
  region: EventRegion;
  city: string;
  country: string;
  citySlug: CitySlug | null;
  month: string;
  category: EventCategory;
  url: string;
  description: string;
  rotates?: boolean;
};

export const CRYPTO_EVENTS: CryptoEvent[] = [
  {
    name: "ETHDenver",
    region: "North America",
    city: "Denver",
    country: "United States",
    citySlug: "denver",
    month: "February",
    category: "Developer & protocol",
    url: "https://www.ethdenver.com",
    description:
      "A week-long Ethereum builder gathering with hackathons, workshops and a large sponsor floor in downtown Denver.",
  },
  {
    name: "Consensus",
    region: "North America",
    city: "Austin",
    country: "United States",
    citySlug: "austin",
    month: "Spring",
    category: "Institutional & policy",
    url: "https://consensus.coindesk.com",
    description:
      "CoinDesk's industry and policy conference, covering trading, regulation and institutional adoption.",
    rotates: true,
  },
  {
    name: "NFT.NYC",
    region: "North America",
    city: "New York",
    country: "United States",
    citySlug: "new-york",
    month: "Spring",
    category: "NFT & culture",
    url: "https://www.nft.nyc",
    description:
      "A conference for NFT collectors, artists and studios, with side events across New York City.",
  },
  {
    name: "Bitcoin Conference",
    region: "North America",
    city: "Rotating US city",
    country: "United States",
    citySlug: null,
    month: "Spring",
    category: "Bitcoin & adoption",
    url: "https://b.tc/conference",
    description:
      "Bitcoin Magazine's flagship conference for the Bitcoin mining, payments and adoption community.",
    rotates: true,
  },
  {
    name: "Permissionless",
    region: "North America",
    city: "Rotating US city",
    country: "United States",
    citySlug: null,
    month: "Summer",
    category: "DeFi & trading",
    url: "https://www.blockworks.co",
    description:
      "Blockworks' DeFi and trading-focused conference, aimed at builders and traders rather than a general audience.",
    rotates: true,
  },
  {
    name: "Paris Blockchain Week",
    region: "Europe",
    city: "Paris",
    country: "France",
    citySlug: "paris",
    month: "April",
    category: "Institutional & policy",
    url: "https://www.parisblockchainweek.com",
    description:
      "One of Europe's larger institutional crypto weeks, mixing regulation, banking and Web3 startup tracks.",
  },
  {
    name: "EthCC",
    region: "Europe",
    city: "Rotating European city",
    country: "Europe",
    citySlug: null,
    month: "Summer",
    category: "Developer & protocol",
    url: "https://www.ethcc.io",
    description:
      "The Ethereum Community Conference, a developer- and researcher-heavy week that has moved between European host cities.",
    rotates: true,
  },
  {
    name: "Web Summit",
    region: "Europe",
    city: "Lisbon",
    country: "Portugal",
    citySlug: "lisbon",
    month: "November",
    category: "General tech",
    url: "https://websummit.com",
    description:
      "A large general technology conference with a crypto and Web3 track alongside its main startup and enterprise stages.",
  },
  {
    name: "Token2049 Dubai",
    region: "Middle East",
    city: "Dubai",
    country: "United Arab Emirates",
    citySlug: "dubai",
    month: "April",
    category: "Trading & exchanges",
    url: "https://www.token2049.com",
    description:
      "The Dubai edition of Token2049, drawing exchanges, market makers and trading firms during MENA crypto week.",
  },
  {
    name: "Token2049 Singapore",
    region: "Asia-Pacific",
    city: "Singapore",
    country: "Singapore",
    citySlug: "singapore",
    month: "September",
    category: "Trading & exchanges",
    url: "https://www.token2049.com",
    description:
      "Token2049's Singapore edition, one of the largest trading- and exchange-focused gatherings in Asia.",
  },
  {
    name: "Korea Blockchain Week",
    region: "Asia-Pacific",
    city: "Seoul",
    country: "South Korea",
    citySlug: "seoul",
    month: "September",
    category: "Institutional & policy",
    url: "https://www.koreablockchainweek.com",
    description:
      "A conference week built around Seoul's crypto exchange and Web3 gaming scene, with satellite side events citywide.",
  },
  {
    name: "Devcon",
    region: "Global",
    city: "Rotating global city",
    country: "Global",
    citySlug: null,
    month: "Varies",
    category: "Developer & protocol",
    url: "https://devcon.org",
    description:
      "The Ethereum Foundation's own developer conference, held in a different city on a multi-year cycle rather than annually in one place.",
    rotates: true,
  },
  {
    name: "Solana Breakpoint",
    region: "Global",
    city: "Rotating global city",
    country: "Global",
    citySlug: null,
    month: "Q3-Q4",
    category: "Developer & protocol",
    url: "https://breakpoint.solana.com",
    description:
      "Solana Foundation's annual flagship conference for the Solana developer and validator ecosystem.",
    rotates: true,
  },
];

export const EVENT_REGIONS: readonly EventRegion[] = [
  "North America",
  "Europe",
  "Middle East",
  "Asia-Pacific",
  "Global",
];

export function eventsByRegion(region: EventRegion): CryptoEvent[] {
  return CRYPTO_EVENTS.filter((event) => event.region === region);
}

/** City job-page link for an event, or null when the event has no stable host city. */
export function eventCityHref(event: CryptoEvent): string | null {
  if (!event.citySlug || !isCitySlug(event.citySlug)) return null;
  return `/web3-jobs-${event.citySlug}`;
}

export function eventCityLabel(event: CryptoEvent): string {
  return event.citySlug ? tagLabel(event.citySlug) : event.city;
}
