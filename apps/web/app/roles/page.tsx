import { HUB_ROLE_SLUGS, hubSlugLabel } from "@gaming/shared";
import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon } from "../_components/icons";
import { JsonLd, absoluteUrl } from "../_components/json-ld";

export const metadata: Metadata = {
  title: "Remote gaming jobs by role",
  description:
    "Every role hub on Studio Direct: gameplay, engine, graphics and tools programming, art, design, production, QA, live ops, audio and more, remote and hybrid.",
  alternates: { canonical: "/roles" },
};

export const revalidate = 300;

/** Short, plain descriptions so each hub card says what the discipline covers. */
const ROLE_NOTES: Record<string, string> = {
  "gameplay-programmer": "Combat, movement, systems and the feel of the game.",
  "engine-programmer": "Runtime, memory, platforms and the code under the game.",
  "graphics-programmer": "Renderers, shaders and frame time.",
  "tools-programmer": "Editors and pipelines the rest of the studio uses.",
  "technical-artist": "The bridge between art and engineering.",
  "technical-designer": "Scripting, prototypes and design tooling.",
  "game-designer": "Mechanics, systems, levels and balance.",
  "narrative-designer": "Story, characters and the words in the game.",
  producer: "Roadmaps, risks and the rhythm of a team.",
  qa: "Test plans, repro steps and release confidence.",
  "live-ops": "Events, economy and the calendar after launch.",
  community: "Players, forums and the voice of the studio.",
  audio: "Sound design, implementation and music systems.",
  "ui-ux": "Interface design and the flow through a game.",
  unity: "Roles that ask for Unity experience.",
  unreal: "Roles that ask for Unreal experience.",
  godot: "Roles that ask for Godot experience.",
  multiplayer: "Netcode, matchmaking and sessions.",
};

export default function RolesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Gaming job roles on Studio Direct",
    numberOfItems: HUB_ROLE_SLUGS.length,
    itemListElement: HUB_ROLE_SLUGS.map((slug, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `Remote ${hubSlugLabel(slug)} jobs`,
      url: absoluteUrl(`/remote-${slug}-jobs`),
    })),
  };

  return (
    <main>
      <JsonLd data={jsonLd} />

      <header className="page-header">
        <span className="kicker">Browse by discipline</span>
        <h1>Gaming jobs by role</h1>
        <p className="lead">
          Each hub collects the remote and hybrid roles whose title matches that discipline,
          from every studio career page we index.
        </p>
      </header>

      <section aria-label="Role hubs" className="jobs-results">
        <div className="jobs-results__head">
          <p className="count">
            <span className="jobs-num">{HUB_ROLE_SLUGS.length}</span> role hubs
          </p>
          <div className="jobs-results__aside">
            <Link className="text-link" href="/jobs">
              Search every role
              <ArrowRightIcon size={15} />
            </Link>
          </div>
        </div>

        <ul className="jobs-role-grid">
          {HUB_ROLE_SLUGS.map((slug) => {
            const label = hubSlugLabel(slug);
            return (
              <li className="jobs-role-card" key={slug}>
                <h2 className="jobs-role-card__title">
                  <Link href={`/remote-${slug}-jobs`}>Remote {label} jobs</Link>
                </h2>
                <p className="jobs-role-card__note">{ROLE_NOTES[slug]}</p>
                <Link className="jobs-role-card__skill chip" href={`/skills/${slug}`}>
                  {label} skill jobs
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="roles-note" className="jobs-more">
        <div className="jobs-more__head">
          <div>
            <h2 id="roles-note">Nothing matching your discipline?</h2>
            <p>
              Search the full catalog instead. Hubs match on the job title, so a role with an
              unusual title still shows up in search.
            </p>
          </div>
          <Link className="text-link" href="/jobs">
            Search all jobs
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
