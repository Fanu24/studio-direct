"use server";
import {redirect} from 'next/navigation';
import {platform,currentUser} from '../../../lib/platform';
import {employerLogin,employerOnboarding,saveEmployer} from '../../../lib/auth/employer';
import {safeNextPath} from '../../../lib/profile/gate';
export async function submitEmployerOnboarding(form:FormData) {
  const next=safeNextPath(String(form.get('next')??''))??'/employer';
  const env=await platform(),user=await currentUser(env);
  if(!user)redirect(employerLogin(next));
  try {
    await saveEmployer(env.DB,user.id,{companyName:String(form.get('companyName')??''),companyUrl:String(form.get('companyUrl')??''),contactName:String(form.get('contactName')??'')});
  } catch {redirect(employerOnboarding(next)+'&error=invalid');}
  redirect(next);
}
