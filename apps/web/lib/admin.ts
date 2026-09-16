import {currentUser,type PlatformEnv} from './platform';
export async function adminUser(env:PlatformEnv,request?:Request){const user=await currentUser(env,request);return user&&(env.ADMIN_EMAILS??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).includes(user.email.toLowerCase())&&user.emailVerified?user:null;}
