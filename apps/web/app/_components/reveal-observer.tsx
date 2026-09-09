"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Reveal driver for browsers without `animation-timeline: view()` — in practice
 * Firefox; Chromium and WebKit 26 both run the CSS path and never reach this.
 *
 * It is deliberately not an IntersectionObserver alone. The previous version was,
 * with a single 0.12 threshold and a shrinking rootMargin, and it raced against
 * the site's own `scroll-behavior: smooth`: a fast or smooth scroll could carry a
 * section past the observed band between callbacks, so the crossing was never
 * reported and the section stayed at opacity 0 permanently. QA reproduced that
 * four times on Firefox, with a different section stranded each run — a page a
 * reader simply cannot read.
 *
 * So the observer is kept as the cheap common path, and a geometry sweep backs it
 * up. The sweep asks a question that cannot be missed — "is this element's top
 * above the bottom of the viewport?" — rather than one that depends on catching a
 * moment. It runs on mount, on scroll (coalesced to one animation frame), and on
 * resize. Revealed nodes leave the set, so the work shrinks to nothing as the
 * reader moves down the page.
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    let pending = new Set(
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)"),
    );
    if (pending.size === 0) return;

    const reveal = (node: HTMLElement) => {
      node.classList.add("is-in");
      pending.delete(node);
    };

    // The sweep. Anything whose top edge has entered the viewport is revealed,
    // and anything already above the viewport is revealed too — that is the case
    // the observer used to lose, when a section was scrolled past between frames.
    const sweep = () => {
      if (pending.size === 0) return;
      const limit = window.innerHeight || document.documentElement.clientHeight;
      for (const node of Array.from(pending)) {
        if (node.getBoundingClientRect().top < limit * 0.94) reveal(node);
      }
      if (pending.size === 0) teardown();
    };

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sweep();
      });
    };

    let observer: IntersectionObserver | undefined;

    const teardown = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pageshow", onScroll);
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) reveal(entry.target as HTMLElement);
          }
        },
        // Threshold 0 and no negative margin: report the crossing as early as
        // possible and let the sweep decide the timing, rather than asking the
        // observer to be precise about a moment it can miss.
        { threshold: 0 },
      );
      for (const node of pending) observer.observe(node);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // Restoring from the back/forward cache does not fire scroll.
    window.addEventListener("pageshow", onScroll);

    sweep();

    return () => {
      teardown();
      pending = new Set();
    };
  }, [pathname]);

  return null;
}
