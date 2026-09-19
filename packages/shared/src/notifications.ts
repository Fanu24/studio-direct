type OutboxDatabase={prepare(sql:string):{bind(...values:unknown[]):{all<T>():Promise<{results:T[]}>;run():Promise<{meta?:{changes?:number}}>}}};
type OutboxEnv={DB:OutboxDatabase;EMAIL_ENABLED?:string;EMAIL_FROM?:string;SITE_URL?:string;EMAIL:{send(message:{to:string;from:string;subject:string;text:string}):Promise<unknown>}};
/** Durable delivery: retry on failure, exclusive lease per notification, never email CVs. */
export async function deliverNotifications(env:OutboxEnv,now=new Date()){
 if(env.EMAIL_ENABLED!=='true'||!env.EMAIL_FROM||!env.SITE_URL)return {sent:0,failed:0};
 const at=now.toISOString(),rows=await env.DB.prepare(`SELECT n.id,n.subject,n.body,n.destination_path,n.attempts,u.email FROM notification_outbox n JOIN users u ON u.id=n.user_id
 WHERE n.sent_at IS NULL AND n.attempts<10 AND (n.retry_at IS NULL OR n.retry_at<=?) AND (n.lease_until IS NULL OR n.lease_until<=?) ORDER BY n.created_at LIMIT 20`).bind(at,at).all<{id:string;subject:string;body:string;destination_path:string;attempts:number;email:string}>();
 let sent=0,failed=0;
 for(const n of rows.results){
  const token=crypto.randomUUID();const claim=await env.DB.prepare(`UPDATE notification_outbox SET lease_token=?,lease_until=? WHERE id=? AND sent_at IS NULL AND (lease_until IS NULL OR lease_until<=?)`).bind(token,new Date(now.getTime()+120000).toISOString(),n.id,at).run();
  if(!claim.meta?.changes)continue;
  try{
   const destination=n.destination_path.startsWith('/')&&!n.destination_path.startsWith('//')?n.destination_path:'/notifications';
   await env.EMAIL.send({to:n.email,from:env.EMAIL_FROM,subject:n.subject,text:n.body+'\n\n'+new URL(destination,env.SITE_URL).href});
   await env.DB.prepare('UPDATE notification_outbox SET sent_at=?,lease_until=NULL,lease_token=NULL,last_error=NULL WHERE id=? AND lease_token=?').bind(at,n.id,token).run();sent++;
  }catch{
   await env.DB.prepare("UPDATE notification_outbox SET attempts=attempts+1,retry_at=?,lease_until=NULL,lease_token=NULL,last_error='Delivery failed' WHERE id=? AND lease_token=?").bind(new Date(now.getTime()+Math.min(86400000,300000*2**n.attempts)).toISOString(),n.id,token).run();failed++;
  }
 }
 return {sent,failed};
}
