import Link from 'next/link';
import {redirect} from 'next/navigation';
import {platform,currentUser} from '../../../lib/platform';
export const dynamic='force-dynamic';
export const metadata={title:'Privacy and account data',robots:{index:false,follow:false}};
export default async function Privacy(){const env=await platform(),user=await currentUser(env);if(!user)redirect('/login?next=/account/privacy');return <main className="container container--content stack"><h1>Privacy and account data</h1><p>Public profile, recruiter discovery and Featured Member are separate choices. Existing privacy choices are preserved.</p><Link href="/account/profile">Change profile visibility and discovery preferences</Link><Link href="/api/account/export">Download your account data</Link><p>Recruiter discovery does not reveal your email or CV. These are shared only with employers to whom you apply.</p><form action="/api/account/delete" method="post"><label>Type DELETE to permanently remove my account and personal data<input name="confirm" pattern="DELETE" required autoComplete="off"/></label><button>Delete account</button></form></main>;}
