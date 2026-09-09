import type { Metadata } from "next";
import Link from "next/link";

import { ArrowUpRightIcon } from "../_components/icons";
import { JsonLd } from "../_components/json-ld";
import { PageHeader } from "../_components/page-header";
import {
  CRYPTO_EVENTS,
  EVENT_REGIONS,
  eventCityHref,
  eventCityLabel,
  eventsByRegion,
} from "./events";

export const metadata: Metadata = {
  title: "Web3 and crypto industry events",
  description:
    "Recurring annual Web3, blockchain and crypto conferences, grouped by region, with host city, month and category. Indicative dates, official sites linked.",
  alternates: { canonical: "/crypto-events" },
};

function eventsJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Recurring Web3 and crypto industry events",
    numberOfItems: CRYPTO_EVENTS.length,
    itemListElement: CRYPTO_EVENTS.map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: event.name,
      url: event.url,
    })),
  };
}

export default function CryptoEventsPage() {
  return (
    <main className="marketing crypto-events">
      <JsonLd data={eventsJsonLd()} />

      <div className="container container--content">
        {PageHeader({
          kicker: "Events",
          title: "Web3 and crypto industry events",
          lead: "Recurring annual conferences the Web3 and crypto industry actually shows up for, grouped by region. Exact dates move year to year, so months are indicative and the official site is the source of truth for the current edition.",
        })}
      </div>

      <section aria-labelledby="events-groups" className="marketing-section">
        <div className="container container--content">
          {EVENT_REGIONS.map((region) => {
            const events = eventsByRegion(region);
            if (events.length === 0) return null;
            return (
              <div className="marketing-region" key={region}>
                <h2>{region}</h2>
                <p className="marketing-region__count">
                  {events.length} recurring event{events.length === 1 ? "" : "s"}
                </p>
                <ul className="marketing-events" aria-label={`${region} events`}>
                  {events.map((event) => {
                    const cityHref = eventCityHref(event);
                    return (
                      <li className="panel marketing-event" key={event.name}>
                        <div className="marketing-event__head">
                          <h3>{event.name}</h3>
                          <span className="marketing-event__month">{event.month}</span>
                        </div>
                        <p className="marketing-event__place">
                          {eventCityLabel(event)}, {event.country}
                          {event.rotates ? " (host city rotates)" : null}
                        </p>
                        <p className="tag">{event.category}</p>
                        <p className="marketing-event__desc">{event.description}</p>
                        <div className="marketing-event__links">
                          <a
                            className="text-link"
                            href={event.url}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            Official site
                            <ArrowUpRightIcon size={14} />
                          </a>
                          {cityHref ? (
                            <Link className="text-link" href={cityHref}>
                              Web3 jobs in {eventCityLabel(event)}
                              <ArrowUpRightIcon size={14} />
                            </Link>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="events-note" className="band marketing-section">
        <div className="container container--content stack">
          <div className="section-head">
            <span className="kicker">A note on dates</span>
            <h2 id="events-note">Why there are no fixed 2026 dates here</h2>
            <p>
              This list is a curated, hand-maintained set of long-running industry
              events, not a live feed, and Nodework does not have an events database
              behind it. Exact dates and venues for a specific year are set by each
              event&apos;s own organizers and can move. Use the official site linked on
              each card to confirm the current edition before booking travel.
            </p>
          </div>
        </div>
      </section>

      <div className="container container--content price-close">
        <p>Hiring or job hunting around one of these events? The catalog is free to browse.</p>
        <div className="cluster">
          <Link className="button button--secondary" href="/jobs">
            Browse Web3 jobs
          </Link>
          <Link className="text-link" href="/web3-cities">
            Web3 jobs by city
            <ArrowUpRightIcon size={14} />
          </Link>
        </div>
      </div>
    </main>
  );
}
