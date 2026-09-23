import Link from 'next/link';
import type {ReactNode} from 'react';
export function EmployerShell({children,title='Employer dashboard'}:{children:ReactNode;title?:string}) {
  return <main className="container container--content stack"><header><span className="kicker">Employer account</span>
    <h1>{title}</h1><nav aria-label="Employer pages" className="cluster">
      <Link href="/employer">Jobs and purchases</Link><Link href="/employer/applications">Applications</Link><Link href="/notifications">Notifications</Link><Link href="/post-web3-job">Post a job</Link>
      <Link href="/pricing">Plans</Link><Link href="/employer/billing">Billing</Link><Link href="/employer/team">Team</Link><Link href="/employer/company">Company page</Link><Link href="/employer/integrations">Integrations</Link><Link href="/dashboard/talent">Talent Search</Link>
      <Link href="/advertiser">Advertising</Link><Link href="/account/support">Support</Link>
    </nav><p><Link href="/login">Switch to candidate account</Link></p></header>{children}</main>;
}
