import {TalentDirectory} from '../_components/talent-directory';
export const dynamic='force-dynamic';
export const metadata={title:'Hire Web3 talent',description:'Browse Web3 candidates by skill, experience and location.',alternates:{canonical:'/hire'}};
export default async function HirePage({searchParams}:{searchParams?:Promise<{q?:string;page?:string}>}){const p=await searchParams;return TalentDirectory({query:p?.q,page:Math.max(1,Number(p?.page)||1)});}
