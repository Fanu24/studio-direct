import Link from 'next/link';
import {redirect} from 'next/navigation';
import {platform,currentUser} from '../../lib/platform';
import {candidatePremium} from '../../lib/product/candidates';
export const dynamic='force-dynamic';
export const metadata={title:'Your applications',robots:{index:false,follow:false}};
export default async function Applications(){
 const env=await platform(),user=await currentUser(env);if(!user)redirect('/login?next=/applications');const premium=await candidatePremium(env.DB,user.id);
 const rows=await env.DB.prepare(`SELECT a.id,a.status,a.created_at,a.cv_r2_key,j.id job_id,j.title,j.slug,j.confidential FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE a.user_id=? ORDER BY a.created_at DESC LIMIT 200`).bind(user.id).all<{id:string;status:string;created_at:string;cv_r2_key:string|null;title:string;slug:string;job_id:string;confidential:number}>();
 const history=premium?(await env.DB.prepare('SELECT h.application_id,h.stage,h.created_at FROM application_stage_history h JOIN job_applications a ON a.id=h.application_id WHERE a.user_id=? ORDER BY h.created_at').bind(user.id).all<{application_id:string;stage:string;created_at:string}>()).results:[];
 return <main className="container stack"><h1>Your applications</h1><Link href="/account">Dashboard</Link>{!premium?<p><Link href="/account/premium">Premium</Link> includes application progress and stage notifications.</p>:null}{!rows.results.length?<p>No applications yet.</p>:rows.results.map(a=><article className="panel" key={a.id}><h2><Link href={a.confidential?'/private-jobs/'+a.job_id:'/jobs/'+a.slug}>{a.title}</Link></h2><p>{premium||a.status==='withdrawn'?a.status:a.status==='redirected'?'Continued to employer website':'Applied'} · {a.created_at.slice(0,10)}</p>{premium?<ol>{history.filter(h=>h.application_id===a.id).map((h,i)=><li key={i}>{h.stage} · {h.created_at}</li>)}</ol>:null}{a.cv_r2_key?<a href={'/api/applications/'+a.id+'/cv'}>Your submitted CV</a>:null}{a.status!=='withdrawn'?<form method="post" action="/api/applications/manage"><input type="hidden" name="id" value={a.id}/><input type="hidden" name="action" value="withdraw"/><button>Withdraw application and remove CV</button></form>:null}</article>)}</main>;
}
