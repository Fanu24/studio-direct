import {ProductEmployerApplications} from '../../_components/product/employer-applications';
import {loadProductFlags} from '../../../lib/product/flags';
import {requireTenantId} from '../../../lib/tenant';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {platform,currentUser} from '../../../lib/platform';
import {APPLICATION_STATUSES} from '../../../lib/jobs/candidate-applications';
import {EmployerShell} from '../../_components/employer-shell';
export const dynamic='force-dynamic';
export const metadata={title:'Manage applications',robots:{index:false,follow:false}};
export default async function Applications({searchParams}:{searchParams:Promise<{status?:string;job?:string;page?:string;score?:string;sort?:string}>}){
 const env=await platform(),user=await currentUser(env);if(!user)redirect('/employer/login?next=/employer/applications');
 const f=await searchParams;if((await loadProductFlags(env.DB,await requireTenantId(env.DB),env)).PRODUCT_COMPANY_PLANS)return <ProductEmployerApplications env={env} userId={user.id} filters={f}/>;const page=Math.min(10000,Math.max(1,Math.floor(Number(f.page)||1)));const conditions=['l.user_id=?',"a.status!='withdrawn'"],values:unknown[]=[user.id];
 if(f.status&&(APPLICATION_STATUSES as readonly string[]).includes(f.status)){conditions.push('a.status=?');values.push(f.status);}if(f.job){conditions.push('a.job_id=?');values.push(f.job);}
 const rows=await env.DB.prepare(`SELECT a.*,j.title FROM job_applications a JOIN employer_listings l ON l.job_id=a.job_id JOIN jobs j ON j.id=a.job_id WHERE ${conditions.join(' AND ')} ORDER BY a.created_at DESC LIMIT 26 OFFSET ?`).bind(...values,(page-1)*25).all<Record<string,any>>();
 const jobs=await env.DB.prepare('SELECT j.id,j.title FROM jobs j JOIN employer_listings l ON l.job_id=j.id WHERE l.user_id=? ORDER BY j.created_at DESC').bind(user.id).all<{id:string;title:string}>();
 const path=(p:number)=>'/employer/applications?'+new URLSearchParams({page:String(p),status:f.status||'',job:f.job||''});
 return <EmployerShell title="Manage applications"><form method="get"><label>Job<select name="job" defaultValue={f.job}><option value="">All jobs</option>{jobs.results.map(j=><option key={j.id} value={j.id}>{j.title}</option>)}</select></label><label>Status<select name="status" defaultValue={f.status}><option value="">All statuses</option>{APPLICATION_STATUSES.map(s=><option key={s}>{s}</option>)}</select></label><button>Filter</button></form>{!rows.results.length?<p>No applications match.</p>:rows.results.slice(0,25).map(a=><article key={a.id} className="panel"><h2>{a.name} · {a.title}</h2><a href={'mailto:'+a.email}>{a.email}</a><p>{a.note}</p>{a.profile_url?<a href={a.profile_url} rel="noopener noreferrer">Candidate website</a>:null}{a.cv_r2_key?<p><a href={'/api/applications/'+a.id+'/cv'}>Download submitted CV</a></p>:null}<form method="post" action="/api/applications/manage"><input name="id" type="hidden" value={a.id}/><label>Status<select name="status" defaultValue={a.status}>{APPLICATION_STATUSES.map(s=><option key={s}>{s}</option>)}</select></label><label>Private notes<textarea name="note" maxLength={4000} defaultValue={a.employer_note}/></label><button>Save</button></form></article>)}<nav>{page>1?<Link href={path(page-1)}>Previous</Link>:null}{rows.results.length>25?<Link href={path(page+1)}>Next</Link>:null}</nav></EmployerShell>;
}
