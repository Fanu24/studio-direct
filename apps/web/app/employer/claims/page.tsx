import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentUser,platform} from '../../../lib/platform';
import {requireTenantId} from '../../../lib/tenant';
import {loadProductFlags} from '../../../lib/product/flags';
import {money} from '@gaming/shared';
import {ClaimPaymentCheck} from '../../_components/product/company-claim-form';

export const dynamic='force-dynamic';
export const metadata={title:'Your company claims',robots:{index:false,follow:false}};
export default async function CompanyClaimsPage() {
  const env=await platform(),user=await currentUser(env),tenant=await requireTenantId(env.DB);
  if(!user)redirect('/employer/login?next=/employer/claims');
  const flags=await loadProductFlags(env.DB,tenant,env);
  const [orders,claims]=await Promise.all([
    env.DB.prepare(`SELECT o.id,o.status,o.total_cents,o.stripe_session_id,c.name FROM company_claim_orders o JOIN companies c ON c.id=o.company_id
      WHERE o.tenant_id=? AND o.user_id=? ORDER BY o.created_at DESC LIMIT 100`).bind(tenant,user.id).all<{id:string;status:string;total_cents:number;stripe_session_id:string|null;name:string}>(),
    env.DB.prepare(`SELECT cc.id,cc.status,cc.reason,c.name FROM company_claims cc JOIN companies c ON c.id=cc.company_id
      WHERE cc.tenant_id=? AND cc.user_id=? ORDER BY cc.created_at DESC LIMIT 100`).bind(tenant,user.id).all<{id:string;status:string;reason:string|null;name:string}>(),
  ]);
  return <main className="container container--content stack"><h1>Your company claims</h1>
    <p>Payment activates your company account. Ownership verification is required before you can manage a company page or reply to reviews.</p>
    <h2>Ownership requests</h2>{!claims.results.length?<p>No ownership request yet. Completed purchases appear here after Stripe confirms payment.</p>:claims.results.map(claim=><article className="panel" key={claim.id}><h3>{claim.name}</h3><p>Ownership: {claim.status}</p>{claim.status==='pending'?<p><Link href="/support">Contact support</Link> with your company website and evidence that you can represent the company. Do not send passwords or API keys.</p>:null}</article>)}
    <h2>Claim purchases</h2>{orders.results.map(order=><article className="panel" key={order.id}><h3>{order.name}</h3><p>{money(order.total_cents)} before checkout discounts and tax · {order.status}</p>{order.status==='pending'&&order.stripe_session_id?<ClaimPaymentCheck orderId={order.id}/>:null}</article>)}
    <p>{flags.PRODUCT_COMPANY_CLAIMS?<><Link href="/claim-company">Claim a company</Link> · </>:null}<Link href="/post-web3-job">Post a job</Link> · <Link href="/employer">Company dashboard</Link></p></main>;
}
