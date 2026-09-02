import type { ReactNode } from "react";

import { ProductVideo } from "../product-video";

export function FeatureRow({
  kicker,
  title,
  children,
  note,
  theater,
  caption,
  tag,
  videoTitle,
  reverse = false,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
  note?: string;
  theater: ReactNode;
  caption: string;
  tag?: string;
  videoTitle: string;
  reverse?: boolean;
}) {
  return (
    <div className={reverse ? "feature feature--reverse" : "feature"} data-reveal>
      <div className="feature__copy">
        <span className="kicker">{kicker}</span>
        <h2>{title}</h2>
        {children}
        {note ? <p className="feature__note">{note}</p> : null}
      </div>
      <div className="feature__media">
        <ProductVideo aspect="tall" caption={caption} tag={tag} title={videoTitle}>
          {theater}
        </ProductVideo>
      </div>
    </div>
  );
}
