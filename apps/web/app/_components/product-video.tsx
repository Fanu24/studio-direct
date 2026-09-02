"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { PauseIcon, PlayIcon } from "./icons";

type PlaybackState = "poster" | "playing" | "paused";

export function ProductVideo({
  title,
  caption,
  tag,
  aspect = "standard",
  children,
}: {
  title: string;
  caption: string;
  tag?: string;
  aspect?: "standard" | "wide" | "tall";
  children: ReactNode;
}) {
  const frame = useRef<HTMLElement>(null);
  const [state, setState] = useState<PlaybackState>("poster");
  const [offscreen, setOffscreen] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!reduce.matches) setState("playing");
  }, []);

  useEffect(() => {
    const node = frame.current;
    if (!node || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(entry ? !entry.isIntersecting : false),
      { threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const playing = state === "playing";

  return (
    <figure
      className={`pv pv--${aspect}`}
      data-offscreen={offscreen ? "true" : undefined}
      data-state={state}
      ref={frame}
    >
      <div className="pv__bar">
        <span className="pv__caption">{caption}</span>
        {tag ? <span className="pv__tag">{tag}</span> : null}
      </div>
      <div className="pv__stage">
        <div aria-hidden="true" className="theater">
          {children}
        </div>
        <button
          aria-label={playing ? `Pause: ${title}` : `Play: ${title}`}
          className="pv__control"
          onClick={() => setState(playing ? "paused" : "playing")}
          type="button"
        >
          {playing ? <PauseIcon size={14} /> : <PlayIcon size={26} />}
        </button>
      </div>
      <figcaption className="visually-hidden">{title}</figcaption>
    </figure>
  );
}
