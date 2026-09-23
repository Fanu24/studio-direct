export interface ProductStatement{bind(...values:unknown[]):ProductStatement;first<T=Record<string,unknown>>(column?:string):Promise<T|null>;all<T=Record<string,unknown>>():Promise<{results:T[]}>;run():Promise<unknown>}
export interface ProductDatabase{prepare(sql:string):ProductStatement;batch(statements:ProductStatement[]):Promise<unknown[]>}
export async function queueProductReminders(db:ProductDatabase,now=new Date()){
 const at=now.toISOString();
 await db.batch([
  db.prepare(`INSERT OR IGNORE INTO notification_outbox(id,user_id,kind,subject,body,destination_path,created_at)
   SELECT 'early:'||r.job_id||':'||r.user_id,r.user_id,'early_access_open','Applications are open: '||j.title,'The Early Access window has ended. You can now apply.','/jobs/'||j.slug||'/apply',?
   FROM early_access_reminders r JOIN jobs j ON j.id=r.job_id WHERE r.notified_at IS NULL AND j.early_access_until<=? AND j.listed=1 AND j.expires_at>?`).bind(at,at,at),
  db.prepare("UPDATE early_access_reminders SET notified_at=? WHERE notified_at IS NULL AND EXISTS(SELECT 1 FROM notification_outbox WHERE id='early:'||early_access_reminders.job_id||':'||early_access_reminders.user_id)").bind(at),
  db.prepare(`INSERT OR IGNORE INTO notification_outbox(id,user_id,kind,subject,body,destination_path,created_at)
   SELECT 'expiry:'||j.id||':'||l.expires_at,l.user_id,'job_expiry','Your job expires soon: '||j.title,'Your post expires in three days or less. Extend it from your dashboard.','/employer',?
   FROM jobs j JOIN employer_listings l ON l.job_id=j.id WHERE j.listed=1 AND l.closed_at IS NULL AND l.expires_at>? AND l.expires_at<=?`).bind(at,at,new Date(now.getTime()+3*86400000).toISOString()),
 ]);
}
