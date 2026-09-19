import {reconcileListingPeriods} from '@gaming/shared';
import {platform,sameOrigin} from '../../../../lib/platform';
import {adminUser} from '../../../../lib/admin';
import {reconcileOrder} from '../../../../lib/billing/reconcile-order';
import {recoverMarketCheckouts} from '../../../../lib/billing/marketplace-recovery';
export async function POST(request:Request){if(!sameOrigin(request))return new Response('Forbidden',{status:403});const env=await platform();if(!await adminUser(env,request))return new Response('Forbidden',{status:403});const form=await request.formData(),id=String(form.get('id')||''),action=form.get('action');
 try{
  if(action==='reconcile'){if(!env.STRIPE_SECRET_KEY)throw new Error('Connect Stripe first');const result=await reconcileOrder(env.DB,env.STRIPE_SECRET_KEY,id,String(form.get('after')||''));return Response.redirect(new URL('/admin/operations?'+new URLSearchParams({reconciled:id,after:result.next||''}),request.url),303);}
  if(action==='recover-sponsors'){if(!env.STRIPE_SECRET_KEY)throw new Error('Connect Stripe first');await recoverMarketCheckouts(env.DB,env.STRIPE_SECRET_KEY);}
  else if(action==='retry-email')await env.DB.prepare('UPDATE notification_outbox SET attempts=0,retry_at=NULL,last_error=NULL WHERE id=? AND sent_at IS NULL').bind(id).run();
  else if(action==='hide-job'){await env.DB.prepare('UPDATE jobs SET moderation_hidden=1,listed=0 WHERE id=?').bind(id).run();}
  else if(action==='unhide-job'){await env.DB.prepare("UPDATE jobs SET moderation_hidden=0,listed=CASE WHEN source!='manual' OR EXISTS(SELECT 1 FROM employer_listings WHERE job_id=jobs.id AND closed_at IS NULL AND expires_at>?) THEN 1 ELSE 0 END WHERE id=?").bind(new Date().toISOString(),id).run();}
  else throw new Error('Invalid action');
  await reconcileListingPeriods(env.DB);
  return Response.redirect(new URL('/admin/operations',request.url),303);
 }catch(e){return new Response(e instanceof Error?e.message:'Operation failed',{status:400});}
}
