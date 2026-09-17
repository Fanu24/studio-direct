import Link from 'next/link';
import {redirect} from 'next/navigation';
import {AccountShell} from '../_components/account-shell';
import {platform,currentUser} from '../../lib/platform';
import {loadProfileCompleteness,loadProfileDetails} from '../../lib/profile/completeness';
export const dynamic='force-dynamic';
export const metadata={title:'Your dashboard',robots:{index:false,follow:false}};
export default async function DashboardPage(){
 const env=await platform(),user=await currentUser(env);
 if(!user)redirect('/login?next=/dashboard');
 const [profile,complete,saved,alerts]=await Promise.all([
  loadProfileDetails(env.DB,user.id),loadProfileCompleteness(env.DB,user.id),
  env.DB.prepare('SELECT COUNT(*) n FROM saved_jobs WHERE user_id=?').bind(user.id).first<number>('n'),
  env.DB.prepare('SELECT COUNT(*) n FROM job_alerts WHERE user_id=? AND enabled=1').bind(user.id).first<number>('n')]);
 return <AccountShell active="dashboard" title={profile?.display_name?`Hi ${profile.display_name}`:'Your dashboard'} lead="Your profile, saved jobs and job alerts.">
 <section className="dash-tiles" aria-label="Account summary">
 <article className="panel dash-tile"><h2>Profile</h2><p>{complete}% complete</p><Link href="/profile">Edit profile and CV</Link><p><Link href="/profile/visibility">Choose who can see your profile</Link></p></article>
 <article className="panel dash-tile"><h2>Saved jobs</h2><p>{saved??0} saved</p><Link href="/saved-jobs">View saved jobs</Link></article>
 <article className="panel dash-tile"><h2>Job alerts</h2><p>{alerts??0} active</p><Link href="/alerts">Manage job alerts</Link></article>
 </section><section className="panel"><h2>Find your next Web3 job</h2><p>Browse and apply to jobs for free.</p><Link className="button" href="/jobs">Browse jobs</Link></section></AccountShell>;
}
