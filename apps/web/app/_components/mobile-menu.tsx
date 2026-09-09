"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ArrowRightIcon, CloseIcon, MenuIcon } from "./icons";
import { NavAccount } from "./nav-account";
import type { NavMenu } from "./nav-data";
import { isCurrent } from "./nav-links";

/**
 * Below the mega-menu breakpoint the primary nav becomes a full-height sheet
 * under the header. Each group is its hub link plus its sub-links as chips, and
 * the account controls close the sheet. The toggle sets aria-expanded, Escape
 * closes and returns focus to it, and the page behind stops scrolling while open.
 */
export function MobileMenu({ menus }: { menus: readonly NavMenu[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggle = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
        return;
      }

      // The sheet covers the page, but covering it visually does not remove the
      // page from the tab order: QA walked 60 real Tab presses straight through
      // the menu and on into the search and filter controls behind the overlay.
      //
      // Focus is moved explicitly here rather than by letting the browser tab
      // and only intervening at the boundary. That boundary approach worked on
      // Chromium and Firefox and failed on WebKit, whose default tab order skips
      // plain links entirely, so the last element was never reached and the
      // wrap never fired. Taking every Tab keeps all three engines identical.
      if (event.key !== "Tab") return;

      const panel = sheet.current;
      if (!panel) return;

      const stops = [
        toggle.current,
        ...panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node): node is HTMLElement => node !== null && node.offsetParent !== null);

      if (stops.length === 0) return;

      event.preventDefault();

      const current = stops.indexOf(document.activeElement as HTMLElement);
      const step = event.shiftKey ? -1 : 1;
      // An unknown active element (focus behind the overlay, or on <body>) is
      // treated as "before the first stop", so Tab pulls focus back in.
      const next = current === -1 ? (event.shiftKey ? stops.length - 1 : 0) : (current + step + stops.length) % stops.length;

      stops[next].focus();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      root.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        aria-controls="mobile-menu"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="menu-button"
        onClick={() => setOpen((value) => !value)}
        ref={toggle}
        type="button"
      >
        {open ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
      </button>
      <nav aria-label="Mobile" className="mobile-menu" hidden={!open} id="mobile-menu" ref={sheet}>
        {menus.map((menu) => (
          <div className="mobile-menu__group" key={menu.label}>
            <Link
              aria-current={isCurrent(pathname, menu.href) ? "page" : undefined}
              className="mobile-menu__hub"
              href={menu.href}
            >
              {menu.label}
              <ArrowRightIcon size={18} />
            </Link>
            <div className="mobile-menu__links">
              {menu.links.map((link) => (
                <Link className="chip" href={link.href} key={`${menu.label}-${link.href}`}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
        <div className="mobile-menu__account">
          <NavAccount variant="menu" />
        </div>
      </nav>
    </>
  );
}
