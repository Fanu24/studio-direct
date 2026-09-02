import Link from "next/link";

import { Marquee } from "../marquee";

export function StudioTicker({
  studios,
}: {
  studios: ReadonlyArray<{ name: string; slug: string }>;
}) {
  if (studios.length === 0) return null;

  // A short list loops too tightly; repeat it so the strip reads as a continuous band.
  const items = studios.length < 8 ? [...studios, ...studios] : studios;

  return (
    <section aria-label="Studios in the index" className="ticker">
      <div className="container">
        <p className="ticker__caption">Studios in the index</p>
      </div>
      <Marquee duration={Math.max(28, items.length * 4)} gap={64}>
        {items.map((studio, index) => (
          <Link
            className="ticker__item"
            href={`/companies/${studio.slug}`}
            key={`${studio.slug}-${index}`}
            tabIndex={index >= studios.length ? -1 : undefined}
          >
            {studio.name}
          </Link>
        ))}
      </Marquee>
    </section>
  );
}
