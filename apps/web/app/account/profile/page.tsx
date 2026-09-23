import Link from 'next/link';
import {redirect} from 'next/navigation';
import {platform,currentUser} from '../../../lib/platform';
import {candidateDetails,profileCompleteness} from '../../../lib/product/candidates';
import {loadProductFlags} from '../../../lib/product/flags';
import {requireTenantId} from '../../../lib/tenant';
import {CandidateProfileForm} from '../../_components/product/candidate-profile-form';
export const dynamic='force-dynamic';
export const metadata={title:'Your candidate profile',robots:{index:false,follow:false}};
export default async function Profile(){const env=await platform(),user=await currentUser(env);if(!user)redirect('/login?next=/account/profile');if(!(await loadProductFlags(env.DB,await requireTenantId(env.DB),env)).PRODUCT_PROFILES_V2)redirect('/profile');
 const details=await candidateDetails(env.DB,user.id),completeness=profileCompleteness(details),countries=await env.DB.prepare('SELECT code,name FROM reference_countries ORDER BY name').bind().all<{code:string;name:string}>();
 return <main className="container container--content stack"><h1>Your candidate profile</h1><nav><Link href="/account/applications">Applications</Link> · <Link href="/account/saved">Saved jobs</Link> · <Link href="/account/premium">Premium</Link> · <Link href="/settings">Account settings</Link></nav><section><h2>Profile {completeness.score}% complete</h2><progress max={100} value={completeness.score}/><ul>{completeness.items.filter(i=>!i.done).map(i=><li key={i.key}>Add {i.key==='skills'?'at least 3 skills':i.key} for {i.points} points.</li>)}</ul></section>
 <CandidateProfileForm details={details} countries={countries.results} name={user.name}/><section><h2>Profile photo</h2><form action="/api/product/profile/photo" method="post" encType="multipart/form-data"><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required/><button>Upload photo</button></form></section><section><h2>Private PDF CV</h2><p>Your CV is shared only through authorized application workflows.</p><form action="/api/profile/cv" method="post" encType="multipart/form-data"><input type="file" name="cv" accept="application/pdf" required/><button>Upload CV</button></form></section>{details.profile?.handle?<Link href={'/talent/'+details.profile.handle}>View profile</Link>:null}</main>;
}
