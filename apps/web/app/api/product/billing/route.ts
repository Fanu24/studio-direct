import {platform,currentUser,sameOrigin,appOrigin} from '../../../../lib/platform';
import {requireTenantId} from '../../../../lib/tenant';
import {loadProductFlags} from '../../../../lib/product/flags';
import {createProductOrder,productOrder,startProductCheckout,reconcileProductOrder,stripeProductRequest,syncProductSubscription,type ProductOrder} from '../../../../lib/product/billing';
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response('Forbidden',{status:403});const env=await platform(),user=await currentUser(env,request);if(!user)return Response.json({login:'/login?next=/pricing',error:'Sign in before purchasing.'},{status:401});
 try{const raw=await request.json(),tenantId=await requireTenantId(env.DB);
  if(raw.action==='resume'){const order=await productOrder(env.DB,String(raw.id));if(!order||order.user_id!==user.id||order.tenant_id!==tenantId)throw Error('Order not found.');return Response.json({url:await startProductCheckout(env,order,user.email)});}
  if(raw.action==='reconcile'){const order=await productOrder(env.DB,String(raw.id));if(!order||order.user_id!==user.id||order.tenant_id!==tenantId)throw Error('Order not found.');await reconcileProductOrder(env,order);return Response.json({status:(await productOrder(env.DB,order.id))?.status});}
  if(raw.action==='portal'||raw.action==='cancel'){
   const order=await productOrder(env.DB,String(raw.id));if(!order||order.user_id!==user.id||order.tenant_id!==tenantId||!order.stripe_customer_id||!env.STRIPE_SECRET_KEY)throw Error('Billing account not found.');
   if(raw.action==='cancel'){if(!order.stripe_subscription_id)throw Error('No subscription.');await stripeProductRequest(env.STRIPE_SECRET_KEY,'subscriptions/'+encodeURIComponent(order.stripe_subscription_id),new URLSearchParams({cancel_at_period_end:'true'}),'cancel-product:'+order.id);await syncProductSubscription(env.DB,env.STRIPE_SECRET_KEY,order.stripe_subscription_id);return Response.json({message:'Renewal canceled. Benefits remain until the end of the paid period.'});}
   const session=await stripeProductRequest(env.STRIPE_SECRET_KEY,'billing_portal/sessions',new URLSearchParams({customer:order.stripe_customer_id,return_url:appOrigin(env)+(order.company_id?'/employer/billing':'/account/billing')}));if(!session.url?.startsWith('https://billing.stripe.com/'))throw Error('Billing portal unavailable.');return Response.json({url:session.url});
  }
  if(typeof raw.id!=='string'||!/^[a-f0-9-]{36}$/i.test(raw.id))throw Error('Invalid purchase ID.');
  const order=await createProductOrder(env.DB,{id:raw.id,tenantId,userId:user.id,kind:raw.kind as ProductOrder['kind'],choice:String(raw.choice??''),payload:raw.payload&&typeof raw.payload==='object'?raw.payload:{},flags:await loadProductFlags(env.DB,tenantId,env)});
  return Response.json({url:await startProductCheckout(env,order,user.email)});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Billing unavailable.'},{status:400});}
}
