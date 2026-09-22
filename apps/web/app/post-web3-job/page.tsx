import {ownedListing} from '../../lib/billing/listing-management';
import type {ListingInput} from '../../lib/billing/listing-input';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {ListingForm} from '../_components/listing-form';
import {platform,currentUser} from '../../lib/platform';
import type {ListingSelection} from '../../lib/billing/listing-catalog';
import {loadProductFlags} from '../../lib/product/flags';
import {requireTenantId} from '../../lib/tenant';
import {ownedNativeListing} from '../../lib/product/native-listings';
import {JobPostForm} from '../_components/product/job-post-form';
export const dynamic='force-dynamic';
export const metadata={title:'Post a Web3 job',description:'Publish a Web3 job and reach candidates searching by skills, location and company.',alternates:{canonical:'/post-web3-job'}};
export default async function PostWeb3JobPage({searchParams}:{searchParams?:Promise<{credit?:string;repost?:string}>}) {
 const {credit,repost}=await searchParams??{};let initialListing:ListingInput|undefined;
 const environment=await platform(),flags=await loadProductFlags(environment.DB,await requireTenantId(environment.DB),environment);
 if(flags.PRODUCT_POSTING_V2&&!credit){
   let previous=null;
   if(repost){const buyer=await currentUser(environment);if(!buyer)redirect('/employer/login?next='+encodeURIComponent('/post-web3-job?repost='+repost));previous=await ownedNativeListing(environment.DB,buyer.id,repost);}
   return <main className="container container--content stack"><h1>Post a Web3 job</h1><p>Publish a job and claim your company page. Your company account activates after payment; ownership verification is separate.</p>
     <p><Link href="/employer">Employer dashboard</Link>{flags.PRODUCT_COMPANY_CLAIMS?<> · <Link href="/claim-company">Claim a company page without a job</Link></>:null}</p>
     {repost&&!previous?<p>Reposting uses the current required fields. Complete the new form before purchasing.</p>:null}
     <JobPostForm initial={previous?.input} initialChoices={previous?.choices} initialAddons={previous?.addons}/></main>;
 }
 if(repost){const env=await platform(),user=await currentUser(env);if(!user)redirect('/employer/login');const job=await ownedListing(env.DB,user.id,repost);if(!job)return <main>Listing not found</main>;initialListing=job.input;}
 let creditSelection:ListingSelection|undefined;
 if(credit){const env=await platform(),user=await currentUser(env);if(!user)redirect(`/employer/login?next=${encodeURIComponent('/post-web3-job?credit='+credit)}`);
 const row=await env.DB.prepare(`SELECT c.selection_json FROM bundle_credits c JOIN employer_orders o ON o.id=c.order_id WHERE c.id=? AND c.user_id=? AND c.job_id IS NULL AND c.expires_at>? AND o.status='paid'`).bind(credit,user.id,new Date().toISOString()).first<{selection_json:string}>();
 if(!row)return <main className="container"><h1>Credit unavailable</h1><Link href="/employer">View your available credits</Link></main>;creditSelection=JSON.parse(row.selection_json);}
 return <main className="container container--content stack"><h1>Post a Web3 job</h1><p>Reach candidates searching by skill, company and location.</p><p><Link href="/post-web3-job/bundle">Save with a job bundle</Link> · <Link href="/employer">Employer dashboard</Link></p><ListingForm repostId={repost} initialListing={initialListing} creditId={credit} creditSelection={creditSelection}/></main>;
}
