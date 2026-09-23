import {notFound,redirect} from 'next/navigation';
import {platform,currentUser} from '../../../../../lib/platform';
import {canManageCompany} from '../../../../../lib/product/company-claims';
import {postingChoices} from '../../../../../lib/product/native-listings';
import {DEFAULT_JOB_ADDONS,type PostingDraft} from '@gaming/shared';
import type {CanonicalPosting} from '../../../../../lib/product/posting-input';
import {requireTenantId} from '../../../../../lib/tenant';
import {loadProductFlags} from '../../../../../lib/product/flags';
import {JobPostForm} from '../../../../_components/product/job-post-form';
export const dynamic='force-dynamic';
export const metadata={title:'Complete an imported draft',robots:{index:false,follow:false}};
export default async function Draft({params}:{params:Promise<{id:string}>}){const env=await platform(),user=await currentUser(env);if(!user)redirect('/employer/login');const tenant=await requireTenantId(env.DB),{id}=await params,row=await env.DB.prepare('SELECT a.posting_json,a.job_id,i.company_id,i.confidential FROM company_ats_jobs a JOIN company_ats_integrations i ON i.id=a.integration_id WHERE a.id=? AND i.tenant_id=?').bind(id,tenant).first<{posting_json:string;job_id:string|null;company_id:string;confidential:number}>();if(!row||!await canManageCompany(env.DB,tenant,user.id,row.company_id))notFound();if(row.job_id)redirect('/employer/jobs/'+encodeURIComponent(row.job_id)+'/edit');const initial=JSON.parse(row.posting_json) as CanonicalPosting,flags=await loadProductFlags(env.DB,tenant,env);initial.companyDomain=new URL(initial.companyUrl).hostname;initial.cities=initial.cityIds.length?(await env.DB.prepare('SELECT * FROM reference_cities WHERE id IN(SELECT value FROM json_each(?))').bind(JSON.stringify(initial.cityIds)).all<CanonicalPosting['cities'][number]>()).results:[];return <main className="container container--content stack"><h1>Complete your imported job</h1><p>Review the required fields and final price. Extra charges require your explicit checkout.</p><JobPostForm atsDraftId={id} initial={initial as PostingDraft} initialChoices={await postingChoices(env.DB,initial)} initialAddons={{...DEFAULT_JOB_ADDONS,confidential:!!row.confidential}} confidentialEnabled={flags.PRODUCT_CONFIDENTIAL_POSTS} earlyAccessEnabled={flags.PRODUCT_EARLY_ACCESS}/></main>;}
