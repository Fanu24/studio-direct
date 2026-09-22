import {notFound} from 'next/navigation';
import {platform} from '../../../lib/platform';
import {adminUser} from '../../../lib/admin';
import {requireTenantId} from '../../../lib/tenant';
export const dynamic='force-dynamic';
export const metadata={title:'Verify company ownership',robots:{index:false,follow:false}};
export default async function AdminCompanyClaimsPage() {
  const env=await platform();if(!await adminUser(env))notFound();
  const claims=await env.DB.prepare(`SELECT cc.id,cc.status,c.name,c.domain,u.email FROM company_claims cc
    JOIN companies c ON c.id=cc.company_id JOIN users u ON u.id=cc.user_id JOIN company_purchase_entitlements e ON e.id=cc.entitlement_id
    WHERE cc.tenant_id=? AND cc.status='pending' AND e.status='active' ORDER BY cc.created_at LIMIT 100`).bind(await requireTenantId(env.DB)).all<{id:string;status:string;name:string;domain:string;email:string}>();
  return <main className="container stack"><h1>Verify company ownership</h1><p>Confirm the applicant is authorized to represent the company using independent evidence. Payment is not proof of ownership.</p>
    {!claims.results.length?<p>No pending claims.</p>:claims.results.map(claim=><article className="panel" key={claim.id}><h2>{claim.name}</h2><p>{claim.domain} · {claim.email}</p>
      <form action="/api/admin/company-claims" method="post" className="stack"><input type="hidden" name="claimId" value={claim.id}/><label htmlFor={'reason-'+claim.id}>Ownership verification record</label><textarea id={'reason-'+claim.id} name="reason" required minLength={10} maxLength={2000}/><button type="submit">Approve verified ownership</button></form></article>)}</main>;
}
