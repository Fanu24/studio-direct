import {ProductBillingPage} from '../../_components/product/billing-page';
export const dynamic='force-dynamic';
export const metadata={title:'Your billing',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{order?:string}>}){return <ProductBillingPage employer={false} orderId={(await searchParams).order}/>;}
