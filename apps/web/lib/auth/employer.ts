import type {Database} from '../platform';
import {httpUrl} from '../platform';
import {safeNextPath} from '../profile/gate';

export type EmployerAccount = {user_id:string;company_name:string;company_url:string;contact_name:string};
export function employerLogin(next = '/employer') {
  return '/employer/login?next=' + encodeURIComponent(safeNextPath(next) ?? '/employer');
}
export function employerOnboarding(next = '/employer') {
  return '/employer/onboarding?next=' + encodeURIComponent(safeNextPath(next) ?? '/employer');
}
export async function loadEmployer(db:Database,userId:string) {
  return db.prepare('SELECT user_id,company_name,company_url,contact_name FROM employer_accounts WHERE user_id=?')
    .bind(userId).first<EmployerAccount>();
}
export async function saveEmployer(db:Database,userId:string,input:{companyName:string;companyUrl:string;contactName:string}) {
  const name=input.companyName.trim(),contact=input.contactName.trim(),url=httpUrl(input.companyUrl.trim());
  if(name.length<2||name.length>160||contact.length<2||contact.length>160||!url) throw new Error('Enter your company, a valid website and your contact name.');
  const now=new Date().toISOString();
  await db.prepare(`INSERT INTO employer_accounts(user_id,company_name,company_url,contact_name,created_at,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET company_name=excluded.company_name,
    company_url=excluded.company_url,contact_name=excluded.contact_name,updated_at=excluded.updated_at`)
    .bind(userId,name,url,contact,now,now).run();
}
export async function employerAccessResponse(db:Database,userId:string,next='/post-web3-job') {
  if(await loadEmployer(db,userId)) return null;
  return Response.json({error:'Complete your employer account before continuing.',login:employerOnboarding(next)},{status:403});
}
