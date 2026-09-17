import {redirect} from 'next/navigation';
import {platform,currentUser} from '../../../lib/platform';
import {loadEmployer,employerLogin} from '../../../lib/auth/employer';
import {safeNextPath} from '../../../lib/profile/gate';
import {submitEmployerOnboarding} from './actions';
export const dynamic='force-dynamic';
export const metadata={title:'Create your employer account',robots:{index:false,follow:false}};
export default async function EmployerOnboarding({searchParams}:{searchParams:Promise<{next?:string;error?:string}>}) {
  const params=await searchParams,next=safeNextPath(params.next)??'/employer';
  const env=await platform(),user=await currentUser(env);
  if(!user)redirect(employerLogin(next));
  if(await loadEmployer(env.DB,user.id))redirect(next);
  return <main className="container container--content stack"><h1>Create your employer account</h1>
    <p>Add your company details to publish jobs and manage applications. Your employer account has its own dashboard.</p>
    {params.error?<p role="alert">Enter your company name, a valid website and your contact name.</p>:null}
    <form action={submitEmployerOnboarding} className="commerce-form">
      <input type="hidden" name="next" value={next}/>
      <label>Company name<input name="companyName" required minLength={2} maxLength={160}/></label>
      <label>Company website<input name="companyUrl" type="url" required/></label>
      <label>Your name<input name="contactName" autoComplete="name" required minLength={2} maxLength={160}/></label>
      <button type="submit" className="button button--primary">Continue to employer dashboard</button>
    </form></main>;
}
