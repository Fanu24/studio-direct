import Link from 'next/link';
import {redirect} from 'next/navigation';
import {ListingForm} from '../_components/listing-form';
import {platform,currentUser} from '../../lib/platform';
import type {ListingSelection} from '../../lib/billing/listing-catalog';
export const dynamic='force-dynamic';
export const metadata={title:'Post a Web3 job',description:'Publish a Web3 job from $299. Choose logo, highlighting, pinned placement and support.',alternates:{canonical:'/post-web3-job'}};
export default async function PostWeb3JobPage({searchParams}:{searchParams?:Promise<{credit?:string}>}) {
 const credit=(await searchParams)?.credit;let creditSelection:ListingSelection|undefined;
 if(credit){const env=await platform(),user=await currentUser(env);if(!user)redirect(`/employer/login?next=${encodeURIComponent('/post-web3-job?credit='+credit)}`);
 const row=await env.DB.prepare(`SELECT c.selection_json FROM bundle_credits c JOIN employer_orders o ON o.id=c.order_id WHERE c.id=? AND c.user_id=? AND c.job_id IS NULL AND c.expires_at>? AND o.status='paid'`).bind(credit,user.id,new Date().toISOString()).first<{selection_json:string}>();
 if(!row)return <main className="container"><h1>Credit unavailable</h1><Link href="/employer">View your available credits</Link></main>;creditSelection=JSON.parse(row.selection_json);}
 return <main className="container container--content stack"><h1>Post a Web3 job</h1><p>Reach candidates searching by skill, company and location.</p><p><Link href="/post-web3-job/bundle">Save with a job bundle</Link> · <Link href="/employer">Employer dashboard</Link></p><ListingForm creditId={credit} creditSelection={creditSelection}/></main>;
}
