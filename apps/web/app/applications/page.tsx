import Link from 'next/link';
import {redirect} from 'next/navigation';
import {platform,currentUser} from '../../lib/platform';
export const dynamic='force-dynamic';
export const metadata={title:'Your applications',robots:{index:false,follow:false}};
export default async function Applications(){const env=await platform(),user=await currentUser(env);if(!user)redirect('/login?next=/applications');
 const rows=await env.DB.prepare(`SELECT a.id,a.status,a.created_at,a.cv_r2_key,j.title,j.slug FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE a.user_id=? ORDER BY a.created_at DESC LIMIT 200`).bind(user.id).all<{id:string;status:string;created_at:string;cv_r2_key:string|null;title:string;slug:string}>();
 return <main className="container stack"><h1>Your applications</h1><Link href="/dashboard">Dashboard</Link>{!rows.results.length?<p>No applications yet.</p>:rows.results.map(a=><article className="panel" key={a.id}><h2><Link href={'/jobs/'+a.slug}>{a.title}</Link></h2><p>{a.status} · {a.created_at.slice(0,10)}</p>{a.cv_r2_key?<a href={'/api/applications/'+a.id+'/cv'}>Your submitted CV</a>:null}{a.status!=='withdrawn'?<form method="post" action="/api/applications/manage"><input type="hidden" name="id" value={a.id}/><input type="hidden" name="action" value="withdraw"/><button>Withdraw application and remove CV</button></form>:null}</article>)}</main>;
}
