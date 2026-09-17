import {renderLoginPage} from './login-page';
export const dynamic='force-dynamic';
export const metadata={title:'Candidate sign in',description:'Sign in with a magic link or Google to manage your candidate profile.',alternates:{canonical:'/login'}};
export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string;intent?:string;next?:string;sent?:string}>}) {
  return renderLoginPage(await searchParams,'candidate');
}
