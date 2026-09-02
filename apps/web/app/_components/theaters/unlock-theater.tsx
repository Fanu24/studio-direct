/* The apply link is always masked. A real apply URL never reaches the marketing page. */
export function UnlockTheater() {
  return (
    <div className="th4">
      <div className="t-window">
        <div className="t-window__bar">
          <span className="t-brand">Studio Direct</span>
          <span className="t-window__url">/jobs/live-ops-designer</span>
        </div>
        <div className="t-window__body th4__body">
          <div className="t-card th4__card">
            <div className="t-card__studio">
              <span>Dream Games</span>
              <span>career page</span>
            </div>
            <div className="t-card__title">Live Ops Designer</div>
            <div className="t-card__meta">Hybrid · Istanbul</div>
            <div className="t-card__foot">
              <span className="t-badge">Not on LinkedIn</span>
            </div>
          </div>
          <div className="th4__panel">
            <div className="t-label">Apply on the studio site</div>
            <div className="th4__actions">
              <span className="th4__button-wrap">
                <span className="t-button th4__button">Unlock application link</span>
                <span className="t-cursor th4__cursor" />
              </span>
              <span className="th4__quota">
                <span className="t-chip th4__quota-before">5 of 5 unlocks left</span>
                <span className="t-chip th4__quota-after">4 of 5 unlocks left</span>
              </span>
            </div>
            <div className="t-chip t-chip--on th4__result">
              Open on the studio site: dreamgames.com/careers/…
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
