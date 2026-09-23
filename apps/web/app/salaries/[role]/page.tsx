import {SalaryInsightPage,salaryInsight} from '../../_components/product/salary-insight-page';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{role:string}>}){const {role}=await params,data=await salaryInsight(role);return {title:(data?.title??'Role')+' salary insights',robots:{index:!!data?.stats,follow:true},alternates:{canonical:'/salaries/'+role},description:data?.stats?`${data.stats.count} external vacancies. Median annual USD salary ${Math.round(data.stats.median)}. Updated ${data.asOf}.`:'A reliable salary sample is not yet available.'};}
export default async function Page({params}:{params:Promise<{role:string}>}){return <SalaryInsightPage role={(await params).role}/>;}
