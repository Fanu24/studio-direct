import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {platform,currentUser} from '../../../lib/platform';
import {orderById} from '../../../lib/billing/employer-orders';
import {CheckoutStatus} from '../../_components/checkout-status';
import {NativePaymentCheck} from '../../_components/product/native-payment-check';
export const dynamic='force-dynamic';
export const metadata={title:'Confirming your job purchase',robots:{index:false,follow:false}};
export default async function Purchase({searchParams}:{searchParams:Promise<{order?:string}>}){
  const id=(await searchParams).order;if(!id)notFound();
  const env=await platform(),user=await currentUser(env);if(!user)redirect('/employer/login?next='+encodeURIComponent('/employer/purchase?order='+id));
  const order=await orderById(env.DB,id);if(!order||order.user_id!==user.id||order.offer_version!==2)notFound();
  return <main className="container stack"><h1>Your job purchase</h1>
    {['pending','paid'].includes(order.status)?<CheckoutStatus orderId={id} confirmed={order.status==='paid'}/>:null}
    {order.status==='pending'?<><NativePaymentCheck orderId={id}/><p>Your company account activates after payment confirmation.</p></>:<p>Order status: {order.status}.</p>}
    {order.status==='cancelled'?<p>This checkout expired. <Link href="/post-web3-job">Return to your saved draft</Link> to start again.</p>:null}
    {order.status==='paid'?<><p>Your job is published. Your company page claim is included and awaits ownership verification.</p><Link href="/employer">Open employer dashboard</Link><Link href="/employer/claims">View company claim</Link></>:null}
    <Link href="/support">Contact support</Link></main>;
}
