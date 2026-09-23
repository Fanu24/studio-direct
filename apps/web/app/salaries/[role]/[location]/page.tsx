import {SalaryInsightPage,salaryInsight} from '../../../_components/product/salary-insight-page';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{role:string;location:string}>}){const {role,location}=await params,data=await salaryInsight(role,location);return {title:(data?.title??'Role')+' salaries · '+location.replaceAll('-',' '),robots:{index:!!data?.stats,follow:true},alternates:{canonical:'/salaries/'+role+'/'+location}};}
export default async function Page({params}:{params:Promise<{role:string;location:string}>}){return <SalaryInsightPage {...await params}/>;}
