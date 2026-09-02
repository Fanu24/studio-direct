"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { CloseIcon, MenuIcon } from "./icons";
import { isCurrent } from "./nav-links";

export function MobileMenu({
  links,
}: {
  links: ReadonlyArray<{ href: string; label: string }>;
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
        {links.map((link) => (
          <Link
            aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        ))}
        <Link href="/about">About</Link>
      </nav>
    </>
  );
}
