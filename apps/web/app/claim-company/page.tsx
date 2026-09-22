import Link from 'next/link';
import {notFound} from 'next/navigation';
import {platform} from '../../lib/platform';
import {requireTenantId} from '../../lib/tenant';
import {loadProductFlags} from '../../lib/product/flags';
import {CompanyClaimForm} from '../_components/product/company-claim-form';

export const dynamic='force-dynamic';
export const metadata={title:'Claim your company page',robots:{index:false,follow:true}};
export default async function ClaimCompanyPage() {
  const env=await platform(),tenant=await requireTenantId(env.DB);
  if(!(await loadProductFlags(env.DB,tenant,env)).PRODUCT_COMPANY_CLAIMS)notFound();
  return <main className="container container--content stack"><h1>Claim your company page</h1>
    <p>Activate your company account and request ownership of your company page.</p><CompanyClaimForm/>
    <p><Link href="/post-web3-job">Post a job with an included company claim</Link> · <Link href="/employer/claims">Your company claims</Link></p></main>;
}
