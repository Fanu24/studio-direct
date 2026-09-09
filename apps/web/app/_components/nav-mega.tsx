"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isCurrent } from "./nav-links";
import type { NavMenu } from "./nav-data";

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
            <span aria-hidden="true" className="nav-mega__caret">
              ▾
            </span>
          </Link>
          <div className="nav-mega__panel">
            {menu.links.map((link) => (
              <Link href={link.href} key={`${menu.label}-${link.href}`}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
