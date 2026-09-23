import {redirect,notFound} from 'next/navigation';
import {platform,currentUser} from '../../../lib/platform';
import {requireTenantId} from '../../../lib/tenant';
import {ProductApplyPanel} from '../../_components/product/apply-panel';
import {companyAccountActive} from '../../../lib/product/company-claims';
import {JOB_ACCESS_SQL} from '../../../lib/product/job-access';
import {sanitizeJobDescriptionHtml} from '../../../lib/jobs/sanitize-description';
export const dynamic='force-dynamic';
export const metadata={title:'Private job',robots:{index:false,follow:false,noarchive:true}};
export default async function PrivateJob({params}:{params:Promise<{id:string}>}){const {id}=await params,env=await platform(),user=await currentUser(env);if(!user)redirect('/login?next='+encodeURIComponent('/private-jobs/'+id));const tenantId=await requireTenantId(env.DB);
 const row=await env.DB.prepare(`SELECT j.id,j.title,j.description_html,j.confidential,CASE WHEN j.hide_salary=0 THEN j.salary_text ELSE NULL END AS salary,CASE WHEN json_extract(n.addons_json,'$.maskCompany')=1 THEN json_extract(n.addons_json,'$.sector') ELSE c.name END AS name,${JOB_ACCESS_SQL} AS can_manage FROM jobs j JOIN companies c ON c.id=j.company_id JOIN employer_listings l ON l.job_id=j.id JOIN native_listing_details n ON n.job_id=j.id WHERE j.id=? AND j.tenant_id=? AND j.confidential=1 AND j.listed=1 AND l.closed_at IS NULL AND j.expires_at>?`).bind(user.id,user.id,id,tenantId,new Date().toISOString()).first<{id:string;title:string;description_html:string;salary:string|null;name:string;can_manage:number}>();if(!row||!row.can_manage&&await companyAccountActive(env.DB,tenantId,user.id))notFound();return <main className="container container--content stack"><p>Confidential job · visible only after sign in</p><h1>{row.title}</h1><h2>{row.name}</h2>{row.salary?<p>{row.salary}</p>:null}<div dangerouslySetInnerHTML={{__html:sanitizeJobDescriptionHtml(row.description_html)}}/><ProductApplyPanel env={env} tenantId={tenantId} user={user} jobId={id}/></main>;}
