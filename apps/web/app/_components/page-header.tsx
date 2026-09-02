import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  lead,
  crumbs,
  actions,
  children,
}: {
  kicker?: string;
  title: ReactNode;
  lead?: ReactNode;
  crumbs?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      {crumbs}
      {kicker ? <span className="kicker">{kicker}</span> : null}
      <h1>{title}</h1>
      {lead ? <p className="lead">{lead}</p> : null}
      {actions ? <div className="cluster page-header__actions">{actions}</div> : null}
      {children}
    </header>
  );
}
