import {ResetPasswordForm} from './reset-form';
export const metadata={title:'Reset password',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;return <main className="container container--content stack"><h1>Reset password</h1>{token?<ResetPasswordForm token={token}/>:<p>This reset link is invalid. Request a new link from the sign-in page.</p>}</main>;}
