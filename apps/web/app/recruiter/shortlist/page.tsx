import Link from 'next/link';
import {redirect} from 'next/navigation';
import {platform,currentUser} from '../../../lib/platform';
import {hasRecruiterAccess} from '../../../lib/billing/marketplace';
export const dynamic='force-dynamic';
export const metadata={title:'Your candidate shortlist',robots:{index:false,follow:false}};
export default async function Shortlist(){const env=await platform(),user=await currentUser(env);if(!user)redirect('/employer/login?next=/recruiter/shortlist');if(!await hasRecruiterAccess(env.DB,user.id))redirect('/recruiter');
 const rows=await env.DB.prepare(`SELECT s.candidate_id,s.note,p.display_name,p.headline FROM recruiter_shortlist s JOIN profiles p ON p.user_id=s.candidate_id WHERE s.recruiter_id=? AND (p.public_profile=1 OR p.talent_pool_opt_in=1) ORDER BY s.created_at DESC LIMIT 200`).bind(user.id).all<{candidate_id:string;note:string;display_name:string;headline:string}>();
 return <main className="container stack"><h1>Your shortlist</h1><Link href="/hire">Search candidates</Link>{!rows.results.length?<p>No saved candidates available.</p>:rows.results.map(p=><article className="panel" key={p.candidate_id}><h2><Link href={'/talent/'+encodeURIComponent(p.candidate_id)}>{p.display_name||'Candidate'}</Link></h2><p>{p.headline}</p><form method="post" action="/api/recruiter/shortlist"><input type="hidden" name="candidate" value={p.candidate_id}/><label>Private recruiting notes<textarea name="note" defaultValue={p.note} maxLength={4000}/></label><button name="action" value="save">Save notes</button><button name="action" value="remove">Remove</button></form></article>)}</main>;
}
