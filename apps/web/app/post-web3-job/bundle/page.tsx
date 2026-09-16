import Link from 'next/link';
import {ListingForm} from '../../_components/listing-form';
export const metadata={title:'Job post bundles',description:'Buy discounted job credits, valid for 24 months.',alternates:{canonical:'/post-web3-job/bundle'}};
export default function BundlePage(){return <main className="container container--content stack"><h1>Job post bundles</h1><p><Link href="/post-web3-job">Post one job</Link> · <Link href="/employer">Your credits</Link></p><ListingForm kind="bundle"/></main>;}
