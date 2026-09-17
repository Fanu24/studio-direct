import {notFound} from 'next/navigation';
import {isJobTag,tagLabel} from '@gaming/shared';
import {TalentDirectory} from '../../_components/talent-directory';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{skill:string}>}){const {skill}=await params;return {title:`Hire ${tagLabel(skill)} talent`,alternates:{canonical:'/hire/'+skill}};}
export default async function HireSkillPage({params,searchParams}:{params:Promise<{skill:string}>;searchParams?:Promise<{q?:string;page?:string}>}){const {skill}=await params;if(!isJobTag(skill))notFound();const p=await searchParams;return TalentDirectory({skill,query:p?.q,page:Math.max(1,Number(p?.page)||1)});}
