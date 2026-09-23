import Link from 'next/link';
import {platform} from '../../lib/platform';
import {publicCandidateText} from '@gaming/shared';
export const dynamic='force-dynamic';
export const metadata={title:'Featured members',alternates:{canonical:'/featured'}};
export default async function Page(){const env=await platform(),rows=await env.DB.prepare('SELECT f.date,p.handle,p.user_id,p.display_name,p.headline FROM featured_members f JOIN profiles p ON p.user_id=f.user_id WHERE p.public_profile=1 AND p.talent_pool_opt_in=1 AND p.featured_opt_in=1 ORDER BY f.date DESC LIMIT 366').bind().all<{date:string;handle:string|null;user_id:string;display_name:string;headline:string}>();return <main className="container stack"><h1>Featured members</h1><p>Premium candidates selected from eligible public profiles.</p>{rows.results.length?rows.results.map(p=><article key={p.date}><time>{p.date}</time><h2><Link href={'/talent/'+(p.handle??p.user_id)}>{publicCandidateText(p.display_name)}</Link></h2><p>{publicCandidateText(p.headline)}</p></article>):<p>No featured members have been selected yet.</p>}</main>;}
