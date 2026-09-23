import Link from 'next/link';
import {notFound} from 'next/navigation';
import {applicationState} from '../../../lib/product/applications';
import type {PlatformEnv} from '../../../lib/platform';
import {InfoTooltip} from './info-tooltip';
export async function ProductApplyPanel({env,tenantId,jobId,user}:{env:PlatformEnv;tenantId:string;jobId:string;user:{id:string;email:string;name:string}|null}){
 const state=await applicationState(env.DB,tenantId,jobId,user?.id??null);if(!state||!state.native)notFound();
 const {job}=state,next=job.confidential?'/private-jobs/'+encodeURIComponent(job.id):'/jobs/'+job.slug+'/apply';
 if(job.confidential&&!user)return <main className="container"><h1>Confidential opportunity</h1><Link href={'/login?next='+encodeURIComponent(next)}>Sign in to continue</Link></main>;
 return <main className="container container--content stack"><h1>Apply: {job.title}</h1><Link href={job.confidential?next:'/jobs/'+job.slug}>Back to the listing</Link>
 {state.closed?<p>This job is closed.</p>:state.application?<p>You already applied. <Link href="/account/applications">View your applications</Link></p>:state.locked?<section><h2>Early Access for Premium members</h2><p>Opens at <time dateTime={job.early_access_until!}>{job.early_access_until}</time> (about {Math.ceil(state.remainingMs/3600000)} hours).</p><InfoTooltip label="Why is Apply restricted?">Premium members and invited candidates can apply during the first 12 hours. Everyone can apply when this window closes.</InfoTooltip><p><Link href="/account/premium">Go Premium</Link> · <Link href={'/login?next='+encodeURIComponent(next)}>Log in</Link></p>{user?<form action="/api/product/apply" method="post"><input type="hidden" name="jobId" value={jobId}/><input type="hidden" name="action" value="remind"/><button>Notify me when it opens</button></form>:null}</section>:user&&!state.verified?<p>Verify your email before applying. <Link href="/login">Send a sign-in link to verify your email</Link>.</p>:!user&&job.apply_mode==='internal'?<p><Link href={'/login?next='+encodeURIComponent(next)}>Sign in to apply</Link></p>:<form action="/api/product/apply" method="post" target={job.apply_mode==='internal'?undefined:'_blank'} rel="noopener noreferrer" encType="multipart/form-data" className="stack">
  <input type="hidden" name="jobId" value={jobId}/><input type="hidden" name="mode" value={job.apply_mode==='internal'?'email':'redirect'}/>
  {!state.eligible?<p role="status">This role is limited to {state.listing?.eligibility?.mode==='geo'?state.listing.eligibility.countryCodes.join(', '):'the listed UTC range'}. Your current profile is outside this eligibility. You can still apply.</p>:null}
  {job.apply_mode==='internal'?<><label>Your name<input name="name" required defaultValue={state.details?.profile?.display_name??user?.name??''}/></label><label>Message<textarea name="note" maxLength={4000}/></label><label>CV (PDF, up to 5 MB)<input type="file" name="cv" accept="application/pdf" required={!state.details?.profile?.cv_r2_key}/></label>{state.details?.profile?.cv_r2_key?<p>Leave the file empty to use a copy of your current profile CV.</p>:null}</>:null}
  {user?<label><input type="checkbox" name="share_application" value="1" required/>Share my profile {job.apply_mode==='internal'?'and CV ':''}with this employer for this application.</label>:<p>You will continue to the employer website.</p>}
  <button>{job.apply_mode==='internal'?'Submit application':'Continue to application website'}</button>
 </form>}</main>;
}
