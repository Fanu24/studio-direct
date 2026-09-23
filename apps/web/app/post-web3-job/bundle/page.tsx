import {redirect} from 'next/navigation';
import {platform} from '../../../lib/platform';
import {requireTenantId} from '../../../lib/tenant';
import {loadProductFlags} from '../../../lib/product/flags';
import Link from 'next/link';
import {ListingForm} from '../../_components/listing-form';
export const metadata={title:'Job post bundles',description:'Buy discounted job credits, valid for 24 months.',alternates:{canonical:'/post-web3-job/bundle'}};
export const dynamic="force-dynamic";
export default async function BundlePage(){const env=await platform();if((await loadProductFlags(env.DB,await requireTenantId(env.DB),env)).PRODUCT_POSTING_V2)redirect("/post-web3-job");return <main className="container container--content stack"><h1>Job post bundles</h1><p><Link href="/post-web3-job">Post one job</Link> · <Link href="/employer">Your credits</Link></p><ListingForm kind="bundle"/></main>;}
