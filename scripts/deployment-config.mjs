/** Pure validation: tests do not need credentials or network access. */
export function configurationErrors(env) {
 const errors=[];
 try {const u=new URL(env.SITE_URL);if(u.protocol!=='https:'||u.hostname==='localhost'||/\.(example|invalid|test)$/.test(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error();}
 catch {errors.push('SITE_URL must be your public HTTPS origin, without a path or credentials');}
 if(env.BETTER_AUTH_URL&&env.BETTER_AUTH_URL.replace(/\/$/,'')!==env.SITE_URL?.replace(/\/$/,''))errors.push('BETTER_AUTH_URL must match SITE_URL');
 if(!env.BETTER_AUTH_SECRET||env.BETTER_AUTH_SECRET.length<32)errors.push('BETTER_AUTH_SECRET must have at least 32 random characters');
 if(env.LOCAL_MAIL==='true')errors.push('LOCAL_MAIL must be disabled in production');
 if(!env.ADMIN_EMAILS?.trim()||env.ADMIN_EMAILS.split(',').some(x=>!/^\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*$/.test(x)))errors.push('ADMIN_EMAILS must contain valid administrator addresses');
 if(!env.TURNSTILE_SITE_KEY||!env.TURNSTILE_SECRET_KEY||/^[123]x0/.test(env.TURNSTILE_SITE_KEY)||/^[123]x0/.test(env.TURNSTILE_SECRET_KEY))errors.push('Configure production Turnstile keys');
 if(env.EMAIL_ENABLED!=='true'||!env.EMAIL_FROM||!env.EMAIL_FROM.includes('@')||/localhost|\.example|\.invalid/.test(env.EMAIL_FROM))errors.push('Activate a verified sender and EMAIL_ENABLED for production login and alerts');
 if(!['true','false',undefined,''].includes(env.STRIPE_ENABLED))errors.push('STRIPE_ENABLED must be true or false');
 if(env.STRIPE_ENABLED==='true'&&(!/^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY||'')||!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')))errors.push('Stripe checkout requires secret and signed webhook keys');
 if(Boolean(env.GOOGLE_CLIENT_ID)!==Boolean(env.GOOGLE_CLIENT_SECRET))errors.push('Set both Google OAuth credentials or leave both empty');
 if(!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID||''))errors.push('CLOUDFLARE_ACCOUNT_ID is required');
 if(!/^[a-f0-9-]{36}$/.test(env.D1_DATABASE_ID||''))errors.push('D1_DATABASE_ID is required');
 if(!/^[a-f0-9]{32}$/.test(env.LOCKS_KV_ID||''))errors.push('LOCKS_KV_ID is required');
 for(const key of ['D1_DATABASE_NAME','R2_BUCKET_NAME','WEB_WORKER_NAME','CRAWLER_WORKER_NAME','QUEUE_PREFIX'])if(!/^[a-z][a-z0-9-]{1,50}$/.test(env[key]||''))errors.push(key+' must name the resource to use');
 if(env.WEB_WORKER_NAME&&env.WEB_WORKER_NAME===env.CRAWLER_WORKER_NAME)errors.push('Web and crawler Workers must have different names');
 return errors;
}

export function deploymentConfig(original, app, env) {
 const config=structuredClone(original);
 config.account_id=env.CLOUDFLARE_ACCOUNT_ID;
 config.name=env[app==='web'?'WEB_WORKER_NAME':'CRAWLER_WORKER_NAME'];
 const previousQueuePrefix=(original.vars?.QUEUE_PREFIX||'crawl')+'-';
 const queueName=name=>env.QUEUE_PREFIX+'-'+(name.startsWith(previousQueuePrefix)?name.slice(previousQueuePrefix.length):name);
 for(const db of config.d1_databases){db.database_id=env.D1_DATABASE_ID;db.database_name=env.D1_DATABASE_NAME;}
 for(const bucket of config.r2_buckets)bucket.bucket_name=env.R2_BUCKET_NAME;
 for(const ns of config.kv_namespaces??[])ns.id=env.LOCKS_KV_ID;
 for(const queue of [...config.queues?.producers??[],...config.queues?.consumers??[]]){
   queue.queue=queueName(queue.queue);
   if(queue.dead_letter_queue)queue.dead_letter_queue=queueName(queue.dead_letter_queue);
 }
 if(app==='crawler')config.vars.QUEUE_PREFIX=env.QUEUE_PREFIX;
 for(const key of ['SITE_URL','EMAIL_ENABLED','EMAIL_FROM','ADMIN_EMAILS'])config.vars[key]=env[key]||'';
 if(app==='web'){config.vars.BETTER_AUTH_URL=env.SITE_URL;config.vars.TURNSTILE_SITE_KEY=env.TURNSTILE_SITE_KEY;config.vars.STRIPE_ENABLED=env.STRIPE_ENABLED||'false';config.vars.LOCAL_MAIL='false';config.vars.SITE_INDEXING_ENABLED=env.SITE_INDEXING_ENABLED||'true';}
 return config;
}
