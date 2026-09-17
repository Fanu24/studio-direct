import Link from 'next/link';
import {redirect} from 'next/navigation';
import {platform,currentUser} from '../../lib/platform';
import {SaveJob} from '../_components/save-job';
export const dynamic='force-dynamic';
export const metadata={title:'Saved jobs',robots:{index:false,follow:false}};
export default async function SavedJobsPage(){const env=await platform(),user=await currentUser(env);if(!user)redirect('/login?next=/saved-jobs');const rows=await env.DB.prepare(`SELECT j.id,j.slug,j.title,j.listed,j.expires_at,c.name FROM saved_jobs s JOIN jobs j ON j.id=s.job_id JOIN companies c ON c.id=j.company_id WHERE s.user_id=? ORDER BY s.created_at DESC LIMIT 1000`).bind(user.id).all<{id:string;slug:string;title:string;listed:number;expires_at:string|null;name:string}>();return <main className="container container--content stack"><h1>Saved jobs</h1>{rows.results.length?rows.results.map(j=><article className="panel" key={j.id}><h2>{j.listed&&(!j.expires_at||j.expires_at>new Date().toISOString())?<Link href={`/jobs/${j.slug}`}>{j.title}</Link>:`${j.title} (closed)`}</h2><p>{j.name}</p><SaveJob jobId={j.id}/></article>):<p>No saved jobs yet. <Link href="/jobs">Browse jobs</Link></p>}</main>;}
