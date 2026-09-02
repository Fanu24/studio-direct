import { Marquee } from "../marquee";

/* Illustrative voices. Each card is labeled as an example until real user quotes are published. */
const VOICES = [
  {
    name: "Priya Raman",
    role: "Gameplay programmer",
    quote:
      "I stopped keeping twelve career pages open in tabs. The badge tells me where LinkedIn would not have helped.",
  },
  {
    name: "Tomasz Wierzbicki",
    role: "Technical artist",
    quote:
      "Filters that mean something: remote, hybrid, studio, and whether the role showed up on LinkedIn.",
  },
  {
    name: "Ana Lucía Ferreira",
    role: "Producer",
    quote: "Applying on the studio site instead of through a middleman is the part I trust.",
  },
  {
    name: "Kwame Mensah",
    role: "Engine programmer",
    quote: "Five unlocks a week is plenty when the list is already narrowed to roles I actually want.",
  },
  {
    name: "Hanna Lindqvist",
    role: "Narrative designer",
    quote: "Reading the full description before unlocking anything saves me from applying blind.",
  },
  {
    name: "Daichi Okamoto",
    role: "QA lead",
    quote: "Same cards everywhere. Search, role hubs, studio pages. I always know where I am.",
  },
];

export function Testimonials() {
  return (
    <section className="section section--tight voices">
      <div className="container section-head">
        <h2>What this feels like in practice</h2>
        <p>Example voices, illustrative until we publish real user quotes.</p>
      </div>
      <Marquee duration={90} gap={20} label="Example voices" reverse>
        {VOICES.map((voice) => (
          <figure className="voice" key={voice.name}>
            <span className="tag voice__tag">Example voice</span>
            <blockquote>
              <p>“{voice.quote}”</p>
            </blockquote>
            <figcaption>
              <strong>{voice.name}</strong>
              <span>{voice.role}</span>
            </figcaption>
          </figure>
        ))}
      </Marquee>
    </section>
  );
}
