import Link from "next/link";
import type { ReactNode } from "react";

export function ArticleLayout({
  title,
  lead,
  toc,
  children,
  breadcrumbs,
  related,
  surface = "stage",
}: {
  title: string;
  lead: string;
  toc: readonly { href: string; label: string }[];
  children: ReactNode;
  breadcrumbs?: ReactNode;
  related?: ReactNode;
  surface?: "stage" | "data";
}) {
  return (
    <main className={`surface surface--${surface}`}>
      <header className="page-header">
        {breadcrumbs}
        <h1>{title}</h1>
        <p className="lead">{lead}</p>
      </header>
      <div className="article-layout">
        <nav aria-label="On this page" className="article-toc">
          <span className="kicker kicker--muted">On this page</span>
          {toc.map((item) => (
            <Link className="text-link" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <article className="container container--content article">
          {children}
          {related}
        </article>
      </div>
    </main>
  );
}
