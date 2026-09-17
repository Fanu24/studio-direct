import { platform,currentUser,sameOrigin,appOrigin } from '../../../../lib/platform';
export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:'Invalid request origin'},{status:403});
  const env=await platform(),user=await currentUser(env,request);
  if(!user)return Response.json({error:'Sign in first'},{status:401});
  const form=await request.formData(),action=String(form.get('action')),id=String(form.get('id'));
  if(action==='close'){
    const owned=await env.DB.prepare(`SELECT o.stripe_subscription_id FROM employer_listings l JOIN employer_orders o ON o.id=l.order_id WHERE l.job_id=? AND l.user_id=?`).bind(id,user.id).first<{stripe_subscription_id:string|null}>();
    if(!owned)return Response.json({error:'Listing not found'},{status:404});
    if(owned.stripe_subscription_id){
      if(!env.STRIPE_SECRET_KEY)return Response.json({error:'Billing must be connected to stop renewal'},{status:503});
      const cancelled=await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(owned.stripe_subscription_id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}});
      if(!cancelled.ok){const result=await cancelled.json() as {error?:{code?:string}};if(result.error?.code!=='resource_missing')return Response.json({error:'Could not stop renewal. Please retry; your listing has not been changed.'},{status:502});}
    }
    await env.DB.batch([
      env.DB.prepare(`UPDATE jobs SET listed=0 WHERE id=? AND id IN(SELECT job_id FROM employer_listings WHERE user_id=?)`).bind(id,user.id),
      env.DB.prepare(`UPDATE employer_listings SET closed_at=? WHERE job_id=? AND user_id=?`).bind(new Date().toISOString(),id,user.id),
    ]);
    return Response.redirect(new URL('/employer',request.url),303);
  }
  if(action==='billing'){
    const customer=await env.DB.prepare(`SELECT stripe_customer_id FROM employer_orders WHERE id=? AND user_id=?`).bind(id,user.id).first<string>('stripe_customer_id');
    if(!customer||!env.STRIPE_SECRET_KEY)return Response.json({error:'Billing account unavailable'},{status:404});
    const result=await fetch('https://api.stripe.com/v1/billing_portal/sessions',{method:'POST',headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({customer,return_url:`${appOrigin(env)}/employer`})});
    if(!result.ok)return Response.json({error:'Billing portal unavailable'},{status:502});
    const data=await result.json() as {url:string};
    if(!data.url?.startsWith('https://billing.stripe.com/'))return Response.json({error:'Invalid billing portal response'},{status:502});
    return Response.redirect(data.url,303);
  }
  return Response.json({error:'Unknown action'},{status:400});
}
