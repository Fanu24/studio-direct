"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { CloseIcon, MenuIcon } from "./icons";
import type { NavMenu } from "./nav-data";
import { isCurrent } from "./nav-links";

export function MobileMenu({
  menus,
}: {
  menus: readonly NavMenu[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        aria-controls="mobile-menu"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="menu-button"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {open ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
      </button>
      <nav aria-label="Mobile" className="mobile-menu" hidden={!open} id="mobile-menu">
        {menus.map((menu) => (
          <div className="mobile-menu__group" key={menu.label}>
            <Link
              aria-current={isCurrent(pathname, menu.href) ? "page" : undefined}
              href={menu.href}
            >
              {menu.label}
            </Link>
            {menu.links.map((link) => (
              <Link href={link.href} key={`${menu.label}-${link.href}`}>
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}
