import { CheckIcon, MinusIcon } from "../icons";

const WITHOUT = [
  "Check LinkedIn and miss career-page-only roles",
  "Open every studio board by hand",
  "No signal which listing was absent from LinkedIn",
];

const WITH = [
  "One board built from studio career pages",
  "Honest Not on LinkedIn badge from the last successful index",
  "5 free unlocks per UTC week, apply on the studio site",
];

export function Comparison({ studios }: { studios: number }) {
  const figure = studios > 0 ? studios.toLocaleString("en-US") : "Every";
  const caption =
    studios > 0
      ? `studio career page${studios === 1 ? "" : "s"} to check by hand`
      : "studio career page, checked by hand";

  return (
    <section className="section compare">
      <div className="container">
        <div className="section-head">
          <h2>The LinkedIn-only hunt, next to Studio Direct.</h2>
        </div>
        <div className="compare__grid">
          <div className="compare__col compare__col--without" data-reveal>
            <p className="compare__label">Without Studio Direct</p>
            <p className="compare__figure">
              <span className="compare__number">{figure}</span>
              <span className="compare__caption">{caption}</span>
            </p>
            <ul className="compare__list">
              {WITHOUT.map((item) => (
                <li key={item}>
                  <MinusIcon size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="compare__col compare__col--with" data-reveal data-reveal-delay="1">
            <p className="compare__label">With Studio Direct</p>
            <p className="compare__figure">
              <span className="compare__number">1</span>
              <span className="compare__caption">board of remote and hybrid gaming roles</span>
            </p>
            <ul className="compare__list">
              {WITH.map((item) => (
                <li key={item}>
                  <CheckIcon size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
