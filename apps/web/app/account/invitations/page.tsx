import Link from 'next/link';
import {redirect} from 'next/navigation';
import {platform,currentUser} from '../../../lib/platform';
export const dynamic='force-dynamic';
export const metadata={title:'Job invitations',robots:{index:false,follow:false}};
export default async function Invitations(){const env=await platform(),user=await currentUser(env);if(!user)redirect('/login?next=/account/invitations');const rows=await env.DB.prepare('SELECT i.*,j.title,j.slug,j.confidential,c.name FROM product_invitations i JOIN jobs j ON j.id=i.job_id JOIN companies c ON c.id=i.company_id WHERE i.candidate_id=? ORDER BY i.sent_at DESC LIMIT 100').bind(user.id).all<Record<string,any>>();return <main className="container container--content stack"><h1>Your invitations</h1><p>These invitations let you apply during Early Access without Premium.</p>{rows.results.length?rows.results.map(i=><article key={i.id}><h2>{i.title} · {i.name}</h2><p>{i.message}</p><p>{i.status}</p><Link href={i.confidential?'/private-jobs/'+encodeURIComponent(i.job_id):'/jobs/'+i.slug}>View job</Link></article>):<p>No invitations yet. Complete your profile and enable discovery to appear in company searches.</p>}</main>;}
