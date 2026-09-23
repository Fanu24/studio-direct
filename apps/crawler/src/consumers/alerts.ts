type AlertEnv=Pick<Env,'DB'|'EMAIL'|'EMAIL_FROM'> & {EMAIL_ENABLED?:string;SITE_URL?:string};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function handleAlert(alertId:string,env:AlertEnv):Promise<{action:'ack'}|{action:'retry';delaySeconds:number}>{
 if(env.EMAIL_ENABLED!=='true'||!env.SITE_URL||!env.EMAIL_FROM)return {action:'ack'};
 const at=new Date().toISOString(),dayAgo=new Date(Date.now()-86400000).toISOString(),lockCutoff=new Date(Date.now()-600000).toISOString();
 const alert=await env.DB.prepare(`SELECT a.*,u.email,u.tenant_id FROM job_alerts a JOIN users u ON u.id=a.user_id WHERE a.id=? AND a.enabled=1 AND u.email_verified=1`).bind(alertId).first<{id:string;email:string;tenant_id:string;query:string;tag:string|null;remote_only:number;created_at:string;last_sent_at:string|null;unsubscribe_token:string}>();
 if(!alert||alert.last_sent_at&&alert.last_sent_at>dayAgo)return {action:'ack'};
 const claim=await env.DB.prepare('UPDATE job_alerts SET last_attempt_at=? WHERE id=? AND enabled=1 AND (last_attempt_at IS NULL OR last_attempt_at<?)').bind(at,alert.id,lockCutoff).run();
 if(!claim.meta.changes)return {action:'retry',delaySeconds:600};
 const filters=['j.tenant_id=?','j.listed = 1 AND j.confidential = 0','j.created_at>?',"(j.expires_at IS NULL OR julianday(j.expires_at)>julianday('now'))"],values:unknown[]=[alert.tenant_id,alert.last_sent_at??alert.created_at];
 if(alert.query){filters.push("j.title LIKE ? ESCAPE '\\'");values.push('%'+alert.query.replace(/[\\%_]/g,'\\$&')+'%');}
 if(alert.tag){filters.push('EXISTS(SELECT 1 FROM job_tags t WHERE t.job_id=j.id AND t.tag_slug=?)');values.push(alert.tag);}
 if(alert.remote_only)filters.push("j.remote='remote'");
 try{const jobs=await env.DB.prepare(`SELECT j.title,j.slug,c.name FROM jobs j JOIN companies c ON c.id=j.company_id WHERE ${filters.join(' AND ')} ORDER BY j.created_at DESC LIMIT 20`).bind(...values).all<{title:string;slug:string;name:string}>();
 if(jobs.results.length){const origin=new URL(env.SITE_URL).origin,unsubscribe=`${origin}/unsubscribe?token=${alert.unsubscribe_token}`;await env.EMAIL.send({from:env.EMAIL_FROM,to:alert.email,subject:`${jobs.results.length} new matching Web3 jobs`,text:jobs.results.map(j=>`${j.title} at ${j.name}: ${origin}/jobs/${encodeURIComponent(j.slug)}`).join('\n')+`\nUnsubscribe: ${unsubscribe}`,html:'<h1>New matching jobs</h1><ul>'+jobs.results.map(j=>`<li><a href="${origin}/jobs/${encodeURIComponent(j.slug)}">${escape(j.title)} at ${escape(j.name)}</a></li>`).join('')+`</ul><p><a href="${unsubscribe}">Unsubscribe</a></p>`});}
 await env.DB.prepare('UPDATE job_alerts SET last_sent_at=?,last_attempt_at=NULL WHERE id=?').bind(at,alert.id).run();return {action:'ack'};
 }catch(error){await env.DB.prepare('UPDATE job_alerts SET last_attempt_at=NULL WHERE id=?').bind(alert.id).run();throw error;}
}
