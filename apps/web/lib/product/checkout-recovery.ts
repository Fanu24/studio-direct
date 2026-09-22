import {stripeRead} from '../billing/invoices';

/** Resume the recorded session; never create another payment for an existing checkout. */
export async function recoverProductCheckout(secret:string,sessionId:string,orderId:string,metadataKey:'orderId'|'claimOrderId',statusUrl:string) {
  const session=await stripeRead(secret,'checkout/sessions/'+encodeURIComponent(sessionId));
  if(session.id!==sessionId||session.livemode!==false||session.metadata?.[metadataKey]!==orderId)throw new Error('Checkout identity mismatch.');
  if(session.status==='expired')return {expired:true as const};
  if(session.status==='complete')return {expired:false as const,url:statusUrl};
  if(session.status!=='open'||typeof session.url!=='string'||!session.url.startsWith('https://checkout.stripe.com/'))throw new Error('Checkout cannot be resumed.');
  return {expired:false as const,url:session.url};
}
