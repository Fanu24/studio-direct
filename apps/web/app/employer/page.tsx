import Link from 'next/link';
import {loadProductFlags} from '../../lib/product/flags';
import {requireTenantId} from '../../lib/tenant';
import {loadEmployer,employerOnboarding} from '../../lib/auth/employer';
import {EmployerShell} from '../_components/employer-shell';
import {CheckoutStatus} from '../_components/checkout-status';
import { redirect } from 'next/navigation';
import { platform,currentUser } from '../../lib/platform';
import { formatUsd } from '../../lib/billing/listing-catalog';
import {ProductEmployerDashboard} from '../_components/product/employer-dashboard';
export const dynamic='force-dynamic';
export const metadata={title:'Employer dashboard',robots:{index:false,follow:false}};
export default async function EmployerPage({searchParams}:{searchParams?:Promise<{order?:string}>}){
  const orderId=(await searchParams)?.order;
  const env=await platform(),user=await currentUser(env);
  if(!user)redirect('/employer/login?next=/employer');
  const product=await loadProductFlags(env.DB,await requireTenantId(env.DB),env);
  if(product.PRODUCT_COMPANY_PLANS)return <ProductEmployerDashboard env={env} userId={user.id}/>;
  const account=await loadEmployer(env.DB,user.id,env);
  if(!account)redirect(employerOnboarding());
  const [orders,listings,credits,applications]=await Promise.all([
    env.DB.prepare('SELECT * FROM employer_orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(user.id).all<{id:string;kind:string;status:string;total_cents:number;stripe_customer_id:string|null;renewal_status:string|null;renewal_next_at:string|null}>(),
    env.DB.prepare(`SELECT j.id,j.title,j.slug,j.listed,l.expires_at FROM employer_listings l JOIN jobs j ON j.id=l.job_id WHERE l.user_id=? ORDER BY j.created_at DESC LIMIT 100`).bind(user.id).all<{id:string;title:string;slug:string;listed:number;expires_at:string}>(),
    env.DB.prepare(`SELECT c.id,c.expires_at FROM bundle_credits c JOIN employer_orders o ON o.id=c.order_id WHERE c.user_id=? AND c.job_id IS NULL AND c.expires_at>? AND o.status='paid' ORDER BY c.expires_at LIMIT 100`).bind(user.id,new Date().toISOString()).all<{id:string;expires_at:string}>(),
    env.DB.prepare(`SELECT a.id,a.name,a.email,a.note,a.profile_url,a.created_at,j.title FROM job_applications a
      JOIN employer_listings l ON l.job_id=a.job_id JOIN jobs j ON j.id=a.job_id WHERE l.user_id=? AND a.status!='withdrawn' ORDER BY a.created_at DESC LIMIT 100`).bind(user.id)
      .all<{id:string;name:string;email:string;note:string;profile_url:string|null;created_at:string;title:string}>(),
  ]);
  return <EmployerShell><p>{account.company_name}</p>
    {orderId&&orders.results.some(o=>o.id===orderId)?<CheckoutStatus orderId={orderId}/>:null}
    <p><Link href="/post-web3-job">Post a job</Link> · {!product.PRODUCT_POSTING_V2?<Link href="/post-web3-job/bundle">Buy a bundle</Link>:<Link href="/employer/claims">Company page claim</Link>} · <Link href="/support">Contact support</Link></p>
    <p>After checkout, publication appears here once Stripe confirms payment. Closing a listing also stops its future automatic renewals. Use Manage billing to review your billing details.</p>
    <h2>Your listings</h2>{!listings.results.length?<p>No published listings yet.</p>:listings.results.map(j=><article className="panel" key={j.id}>
      <h3><Link href={`/jobs/${j.slug}`}>{j.title}</Link></h3><p>{j.listed?'Published':'Closed'} · Expires {j.expires_at.slice(0,10)}</p>
      <p><Link href={'/employer/jobs/'+encodeURIComponent(j.id)+'/edit'}>Edit listing</Link> · <Link href={'/post-web3-job?repost='+encodeURIComponent(j.id)}>Repost with a new purchase</Link></p>
      {j.listed?<form action="/api/employer/manage" method="post"><input type="hidden" name="action" value="close"/><input type="hidden" name="id" value={j.id}/><button type="submit">Close listing</button></form>:null}</article>)}
    <h2>Available credits ({credits.results.length})</h2>{credits.results.map(c=><p key={c.id}><Link href={`/post-web3-job?credit=${encodeURIComponent(c.id)}`}>Use a job credit</Link> · Expires {c.expires_at.slice(0,10)}</p>)}
    <h2>Applications</h2><Link href="/employer/applications">Manage applications and CVs</Link>{!applications.results.length?<p>No applications received yet.</p>:applications.results.map(a=><article key={a.id} className="panel"><h3>{a.name} · {a.title}</h3>
      <a href={`mailto:${a.email}`}>{a.email}</a><p>{a.note}</p>{a.profile_url?<a href={a.profile_url} rel="noopener noreferrer" target="_blank">Applicant profile</a>:null}<p>{a.created_at.slice(0,10)}</p></article>)}
    <h2>Orders</h2>{orders.results.map(o=><article key={o.id} className="panel"><p>{o.kind==='bundle'?'Job bundle':'Job listing'} · {formatUsd(o.total_cents)} before checkout discounts/tax · {o.status}</p>
      {o.renewal_status?<p>Renewal: {o.renewal_status}{o.renewal_next_at?' · '+o.renewal_next_at.slice(0,10):''}</p>:null}
      {o.stripe_customer_id?<form action="/api/employer/manage" method="post"><input type="hidden" name="action" value="billing"/><input type="hidden" name="id" value={o.id}/><button type="submit">Manage billing and renewals</button></form>:null}</article>)}
  </EmployerShell>;
}
