/* The "Not on LinkedIn" chip toggles, and the one role without a badge fades back. */
const CARDS = [
  {
    studio: "Riot Games",
    title: "Senior Gameplay Engineer",
    meta: "Remote · Los Angeles",
    badge: true,
  },
  {
    studio: "Epic Games",
    title: "Gameplay Programmer, Fortnite",
    meta: "Remote · Cary",
    badge: false,
  },
  {
    studio: "Scopely",
    title: "Gameplay Programmer",
    meta: "Hybrid · Barcelona",
    badge: true,
  },
];

export function OneBoardTheater() {
  return (
    <div className="th6">
      <div className="t-window">
        <div className="t-window__bar">
          <span className="t-brand">Studio Direct</span>
          <span className="t-window__url">/remote-gameplay-programmer-jobs</span>
        </div>
        <div className="t-window__body th6__body">
          <div className="th6__head">
            <div className="th6__title">Remote Gameplay Programmer jobs</div>
            <div className="t-chips">
              <span className="t-chip t-chip--on">Remote</span>
              <span className="t-chip">Hybrid</span>
              <span className="t-chip t-chip--on th6__chip-hidden">Not on LinkedIn</span>
            </div>
          </div>
          <div className="t-list th6__list">
            {CARDS.map((card, index) => (
              <div
                className={`t-card t-card--row th6__card th6__card--${index + 1}${
                  card.badge ? "" : " th6__card--plain"
                }`}
                key={card.title}
              >
                <span className="t-card__title">{card.title}</span>
                <span className="t-card__meta">
                  {card.studio} · {card.meta}
                </span>
                {card.badge ? <span className="t-badge">Not on LinkedIn</span> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
