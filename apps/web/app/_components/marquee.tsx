import type { CSSProperties, ReactNode } from "react";

export function Marquee({
  children,
  duration = 40,
  gap = 48,
  reverse = false,
  label,
  className,
}: {
  children: ReactNode;
  duration?: number;
  gap?: number;
  reverse?: boolean;
  label?: string;
  className?: string;
}) {
  const style = {
    "--marquee-duration": `${duration}s`,
    "--marquee-gap": `${gap}px`,
  } as CSSProperties;

  return (
    <div
      aria-label={label}
      className={["marquee", reverse ? "marquee--reverse" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      role={label ? "region" : undefined}
      style={style}
    >
      <div className="marquee__track">
        <div className="marquee__group">{children}</div>
        {/* The second copy only exists to make the loop seamless. `inert` keeps its links
            out of the tab order, which `aria-hidden` alone would not do. */}
        <div aria-hidden="true" className="marquee__group" inert>
          {children}
        </div>
      </div>
    </div>
  );
}
