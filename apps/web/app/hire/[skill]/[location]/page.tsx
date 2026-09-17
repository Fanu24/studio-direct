import {notFound} from 'next/navigation';
import {isJobTag,tagLabel} from '@gaming/shared';
import {TalentDirectory} from '../../../_components/talent-directory';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{skill:string;location:string}>}){const {skill,location}=await params;return {title:`Hire ${tagLabel(skill)} talent in ${tagLabel(location)}`,alternates:{canonical:`/hire/${skill}/${location}`}};}
export default async function HireLocationPage({params,searchParams}:{params:Promise<{skill:string;location:string}>;searchParams?:Promise<{q?:string;page?:string}>}){const {skill,location}=await params;if(!isJobTag(skill)||!/^[a-z0-9-]{1,100}$/.test(location))notFound();const p=await searchParams;return TalentDirectory({skill,location,query:p?.q,page:Math.max(1,Number(p?.page)||1)});}
