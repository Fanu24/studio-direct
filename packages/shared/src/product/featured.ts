import type {ProductDatabase} from './notifications';
export const FEATURED_ELIGIBILITY_SQL=`p.public_profile=1 AND p.talent_pool_opt_in=1 AND p.featured_opt_in=1 AND p.product_profile_completed=1 AND p.completeness>=80 AND s.status IN ('active','trialing') AND s.renews_at>?`;
export async function selectDailyFeatured(db:ProductDatabase,tenantId:string,now=new Date()){
 const date=now.toISOString().slice(0,10),at=now.toISOString();
 if(!await db.prepare("SELECT name FROM feature_flags WHERE tenant_id=? AND name='PRODUCT_FEATURED_MEMBERS' AND enabled=1").bind(tenantId).first())return;
 if(await db.prepare("SELECT kind FROM product_daily_runs WHERE kind=? AND date=?").bind('featured:'+tenantId,date).first())return;
 let candidate:{user_id:string}|null=null;
 for(const days of [90,30]){candidate=await db.prepare(`SELECT p.user_id FROM profiles p JOIN users u ON u.id=p.user_id JOIN candidate_subscriptions s ON s.user_id=p.user_id WHERE u.tenant_id=? AND ${FEATURED_ELIGIBILITY_SQL}
 AND NOT EXISTS(SELECT 1 FROM featured_members f WHERE f.user_id=p.user_id AND f.date>=?) ORDER BY random() LIMIT 1`).bind(tenantId,at,new Date(now.getTime()-days*86400000).toISOString().slice(0,10)).first<{user_id:string}>();if(candidate)break;}
 await db.batch([
  db.prepare(`INSERT OR IGNORE INTO featured_members(date,user_id,selected_at,source) SELECT ?,?,?,'auto' WHERE ? IS NOT NULL AND NOT EXISTS(SELECT 1 FROM product_daily_runs WHERE kind=? AND date=?)`).bind(date,candidate?.user_id??null,at,candidate?.user_id??null,'featured:'+tenantId,date),
  db.prepare(`INSERT OR IGNORE INTO notification_outbox(id,user_id,kind,subject,body,destination_path,created_at) SELECT 'featured:'||date,user_id,'featured_member','You are today’s featured member','Your public profile is featured today. View your profile and share it.','/talent/'||COALESCE((SELECT handle FROM profiles WHERE user_id=featured_members.user_id),user_id),? FROM featured_members WHERE date=? AND user_id IS NOT NULL`).bind(at,date),
  db.prepare('INSERT OR IGNORE INTO product_daily_runs(kind,date,finished_at) VALUES(?,?,?)').bind('featured:'+tenantId,date,at),
 ]);
}
