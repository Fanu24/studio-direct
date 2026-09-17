import {renderLoginPage} from '../../login/login-page';
export const dynamic='force-dynamic';
export const metadata={title:'Employer sign in',robots:{index:false,follow:false}};
export default async function EmployerLoginPage({searchParams}:{searchParams:Promise<{error?:string;next?:string;intent?:string;sent?:string}>}) {
  return renderLoginPage(await searchParams,'employer');
}
