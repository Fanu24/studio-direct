import Link from "next/link";

import "../styles/learn.css";
import { learnCategoryLabel } from "../learn-web3/categories";
import type { LearnResource } from "../learn-web3/resources";

const LEVEL_LABELS: Record<LearnResource["level"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function thumbnailGlyph(source: string): string {
  const cleaned = source.replace(/[^A-Za-z0-9]/g, "");
  return (cleaned.slice(0, 2) || source.slice(0, 2) || "?").toUpperCase();
}

export function ResourceGrid({
  resources,
  emptyMessage,
}: {
  resources: readonly LearnResource[];
  emptyMessage: string;
}) {
  if (resources.length === 0) {
    return (
      <div className="empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="resource-grid">
      {resources.map((resource) => (
        <li key={resource.slug}>
          <article className="resource-card">
            <div aria-hidden="true" className="resource-card__thumb">
              {thumbnailGlyph(resource.source)}
            </div>
            <div className="resource-card__body">
              <div className="resource-card__head">
                <span className="badge resource-card__level">
                  {LEVEL_LABELS[resource.level]}
                </span>
                <span className="resource-card__source">{resource.source}</span>
              </div>
              <h3 className="resource-card__title">{resource.title}</h3>
              <p className="resource-card__summary">{resource.summary}</p>
              <div className="chips resource-card__topics">
                {resource.topics.map((topic) => (
                  <Link className="chip" href={`/learn-web3/${topic}`} key={topic}>
                    {learnCategoryLabel(topic)}
                  </Link>
                ))}
              </div>
              <a
                className="button button--sm button--ghost resource-card__cta"
                href={resource.url}
                rel="noopener noreferrer nofollow"
                target="_blank"
              >
                Learn More
              </a>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
