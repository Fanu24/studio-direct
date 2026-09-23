import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Shortlist({searchParams}:{searchParams:Promise<{job?:string}>}){const {job}=await searchParams;redirect('/dashboard/talent?shortlist=1&job='+encodeURIComponent(job??''));}
