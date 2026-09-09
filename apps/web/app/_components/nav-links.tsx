"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string };

/** True for the link itself and for anything nested under it, so /web3-companies/riot marks Studios. */
export function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ links }: { links: ReadonlyArray<NavLink> }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="nav-links">
      {links.map((link) => (
        <Link
          aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
