import type {Database} from '../platform';
import {httpUrl} from '../platform';
import {safeNextPath} from '../profile/gate';
import type {ProductFlag} from '@gaming/shared';
import {loadProductFlags} from '../product/flags';
import {companyAccountActive} from '../product/company-claims';

export type EmployerAccount = {user_id:string;company_name:string;company_url:string;contact_name:string};
export function employerLogin(next = '/employer') {
  return '/employer/login?next=' + encodeURIComponent(safeNextPath(next) ?? '/employer');
}
export function employerOnboarding(next = '/employer') {
  return '/employer/onboarding?next=' + encodeURIComponent(safeNextPath(next) ?? '/employer');
}
export async function companyPurchaseRequired(db:Database,userId:string,env:Partial<Record<ProductFlag,string>>={}) {
  const user=await db.prepare('SELECT tenant_id FROM users WHERE id=?').bind(userId).first<{tenant_id:string}>();
  return !!user&&(await loadProductFlags(db,user.tenant_id,env)).PRODUCT_POSTING_V2;
}
export async function loadEmployer(db:Database,userId:string,env:Partial<Record<ProductFlag,string>>={}) {
  if(await companyPurchaseRequired(db,userId,env)) {
    const user=await db.prepare('SELECT tenant_id FROM users WHERE id=?').bind(userId).first<{tenant_id:string}>();
    if(!user||!await companyAccountActive(db,user.tenant_id,userId))return null;
  }
  return db.prepare('SELECT user_id,company_name,company_url,contact_name FROM employer_accounts WHERE user_id=?')
    .bind(userId).first<EmployerAccount>();
}
export async function saveEmployer(db:Database,userId:string,input:{companyName:string;companyUrl:string;contactName:string},env:Partial<Record<ProductFlag,string>>={}) {
  if(await companyPurchaseRequired(db,userId,env)&&!await loadEmployer(db,userId,env))throw new Error('Purchase a job, an annual plan or a company claim to activate your company account.');
  const name=input.companyName.trim(),contact=input.contactName.trim(),url=httpUrl(input.companyUrl.trim());
  if(name.length<2||name.length>160||contact.length<2||contact.length>160||!url) throw new Error('Enter your company, a valid website and your contact name.');
  const now=new Date().toISOString();
  await db.prepare(`INSERT INTO employer_accounts(user_id,company_name,company_url,contact_name,created_at,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET company_name=excluded.company_name,
    company_url=excluded.company_url,contact_name=excluded.contact_name,updated_at=excluded.updated_at`)
    .bind(userId,name,url,contact,now,now).run();
}
export async function employerAccessResponse(db:Database,userId:string,next='/post-web3-job',env:Partial<Record<ProductFlag,string>>={}) {
  if(await loadEmployer(db,userId,env)) return null;
  return Response.json({error:'Complete your employer account before continuing.',login:employerOnboarding(next)},{status:403});
}
