/* Domains only. A role count here would be an invented number sitting next to a real studio. */
const SOURCES = [
  { mark: "R", domain: "riotgames.com/careers" },
  { mark: "D", domain: "dreamgames.com/careers" },
  { mark: "S", domain: "scopely.com/careers" },
];

const CARDS = [
  {
    studio: "Riot Games",
    source: "career page",
    title: "Senior Gameplay Engineer",
    meta: "Remote · Los Angeles",
    badge: true,
  },
  {
    studio: "Dream Games",
    source: "career page",
    title: "Live Ops Designer",
    meta: "Hybrid · Istanbul",
    badge: true,
  },
  {
    studio: "Scopely",
    source: "career page",
    title: "Backend Engineer, Multiplayer",
    meta: "Remote · Barcelona",
    badge: false,
  },
];

export function CareerPagesTheater() {
  return (
    <div className="th1">
      <div className="th1__sources">
        <div className="t-label">Studio career pages</div>
        <div className="t-list">
          {SOURCES.map((source, index) => (
            <div className={`t-site t-site--${index + 1}`} key={source.domain}>
              <span className="t-site__mark">{source.mark}</span>
              <span className="t-site__domain">{source.domain}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="th1__flow" />
      <div className="th1__board">
        <div className="t-label">
          <span className="t-brand">Studio Direct</span>
        </div>
        <div className="t-list">
          {CARDS.map((card, index) => (
            <div className={`t-card t-card--${index + 1}`} key={card.title}>
              <div className="t-card__studio">
                <span>{card.studio}</span>
                <span>{card.source}</span>
              </div>
              <div className="t-card__title">{card.title}</div>
              <div className="t-card__meta">{card.meta}</div>
              {card.badge ? (
                <div className="t-card__foot">
                  <span className="t-badge">Not on LinkedIn</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
