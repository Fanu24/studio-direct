import Link from "next/link";
import type { ReactNode } from "react";

export type AccountTab = "dashboard" | "profile" | "settings";

const ACCOUNT_TABS: { id: AccountTab; href: string; label: string }[] = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard" },
  { id: "profile", href: "/profile", label: "Profile" },
  { id: "settings", href: "/settings", label: "Settings" },
];

export function AccountShell({
  title,
  lead,
  active,
  children,
}: {
  title: ReactNode;
  lead?: ReactNode;
  active: AccountTab;
  children: ReactNode;
}) {
  return (
    <main className="acct-main">
      <header className="acct-head">
        <div className="container container--content">
          <span className="kicker">Account</span>
          <h1 className="acct-head__title">{title}</h1>
          {lead ? <p className="lead acct-head__lead">{lead}</p> : null}
          <nav aria-label="Account pages" className="acct-tabs">
            {ACCOUNT_TABS.map((tab) => (
              <Link
                aria-current={tab.id === active ? "page" : undefined}
                href={tab.href}
                key={tab.id}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="container container--content acct-body">{children}</div>
    </main>
  );
}
