/* Wide stage: the toolbar sits left, the result rows right, so five rows fit a 21:9 frame.
   The matching row is first, so the four others can collapse without moving it. */
const RESULTS = [
  {
    studio: "Riot Games",
    title: "Senior Gameplay Engineer",
    meta: "Remote · Los Angeles",
    badge: true,
    match: true,
  },
  {
    studio: "Dream Games",
    title: "Live Ops Designer",
    meta: "Hybrid · Istanbul",
    badge: true,
    match: false,
  },
  {
    studio: "Scopely",
    title: "Backend Engineer, Multiplayer",
    meta: "Remote · Barcelona",
    badge: false,
    match: false,
  },
  {
    studio: "Epic Games",
    title: "Tools Programmer, Unreal Editor",
    meta: "Remote · Cary",
    badge: false,
    match: false,
  },
  {
    studio: "Roblox",
    title: "Technical Artist",
    meta: "Hybrid · San Mateo",
    badge: true,
    match: false,
  },
];

export function SearchTheater() {
  return (
    <div className="th3">
      <div className="t-window">
        <div className="t-window__bar">
          <span className="t-brand">Studio Direct</span>
          <span className="t-window__url">/jobs?q=Gameplay</span>
        </div>
        <div className="t-window__body th3__body">
          <div className="th3__toolbar">
            <div className="t-label">Search the board</div>
            <div className="t-input t-input--active th3__input">
              <span className="t-input__icon" />
              <span className="th3__typed">Gameplay</span>
              <span className="t-caret th3__caret" />
            </div>
            <div className="t-chips th3__chips">
              <span className="t-chip">Any studio</span>
              <span className="t-chip">Senior</span>
              <span className="t-chip t-chip--on">Not on LinkedIn</span>
            </div>
            <div className="th3__count">
              <span className="t-count th3__count-all">5 jobs</span>
              <span className="t-count th3__count-one">1 job</span>
            </div>
          </div>
          <div className="th3__list">
            {RESULTS.map((job, index) => (
              <div
                className={`t-card t-card--row th3__row th3__row--${index + 1}${
                  job.match ? " th3__row--match" : ""
                }`}
                key={job.title}
              >
                <span className="t-card__title">{job.title}</span>
                <span className="t-card__meta">
                  {job.studio} · {job.meta}
                </span>
                {job.badge ? <span className="t-badge">Not on LinkedIn</span> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
