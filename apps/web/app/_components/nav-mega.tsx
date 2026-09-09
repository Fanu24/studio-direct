"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isCurrent } from "./nav-links";
import type { NavMenu } from "./nav-data";

function Caret() {
  return (
    <svg
      aria-hidden="true"
      className="nav-mega__caret"
      fill="none"
      focusable="false"
      height="10"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 10 10"
      width="10"
    >
      <path d="M2 3.5 5 6.5 8 3.5" />
    </svg>
  );
}

/**
 * Primary navigation. Each trigger is a real link to its hub, and the panel
 * opens on hover or focus-within, so it works with no JavaScript and is fully
 * keyboard reachable: Tab into a trigger opens its panel, Tab on through it.
 */
export function NavMega({ menus }: { menus: readonly NavMenu[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="nav-mega">
      {menus.map((menu) => (
        <div className="nav-mega__item" key={menu.label}>
          <Link
            aria-current={isCurrent(pathname, menu.href) ? "page" : undefined}
            className="nav-mega__trigger"
            href={menu.href}
          >
            {menu.label}
            <Caret />
          </Link>
          <div className="nav-mega__panel" data-cols={menu.links.length > 8 ? 2 : 1}>
            <div className="nav-mega__links">
              {menu.links.map((link) => (
                <Link
                  aria-current={
                    link.href !== menu.href && isCurrent(pathname, link.href) ? "page" : undefined
                  }
                  href={link.href}
                  key={`${menu.label}-${link.href}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ))}
    </nav>
  );
}
