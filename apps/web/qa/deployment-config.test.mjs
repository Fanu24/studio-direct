import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {configurationErrors,deploymentConfig} from '../../../scripts/deployment-config.mjs';
const env={SITE_URL:'https://jobs.example.com',ADMIN_EMAILS:'admin@example.com',EMAIL_ENABLED:'true',EMAIL_FROM:'mail@example.com',BETTER_AUTH_SECRET:'secret-for-this-fixture-'.repeat(3),TURNSTILE_SITE_KEY:'test-production-site',TURNSTILE_SECRET_KEY:'test-production-secret',STRIPE_ENABLED:'false',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),D1_DATABASE_ID:'12345678-1234-1234-1234-123456789012',D1_DATABASE_NAME:'qa-database',LOCKS_KV_ID:'b'.repeat(32),R2_BUCKET_NAME:'qa-files',WEB_WORKER_NAME:'qa-web',CRAWLER_WORKER_NAME:'qa-crawler',QUEUE_PREFIX:'qa-crawl'};
it('prepares both workers with the selected resources, without mutating originals or including secrets',()=>{
 expect(configurationErrors(env)).toEqual([]);
 for(const app of ['web','crawler']){
  const original=JSON.parse(readFileSync(new URL(`../../${app}/wrangler.jsonc`,import.meta.url),'utf8'));
  const before=JSON.stringify(original),c=deploymentConfig(original,app,env);
  expect(JSON.stringify(original)).toBe(before);expect(c.account_id).toBe(env.CLOUDFLARE_ACCOUNT_ID);
  expect(c.d1_databases[0]).toMatchObject({database_id:env.D1_DATABASE_ID,database_name:'qa-database'});
  expect(c.r2_buckets[0].bucket_name).toBe('qa-files');
  expect(JSON.stringify(c)).not.toContain(env.BETTER_AUTH_SECRET);
  if(app==='crawler'){
   expect(c.queues.producers[0].queue).toBe(c.queues.consumers[0].queue);
   expect(c.queues.consumers[0].dead_letter_queue).toBe('qa-crawl-career-failed');
  }else expect(c.vars.LOCAL_MAIL).toBe('false');
 }
});
it('fails before writing for local credentials, mismatched origins, missing bindings or partial providers',()=>{
 expect(configurationErrors({...env,SITE_URL:'http://localhost:3000',LOCAL_MAIL:'true',D1_DATABASE_ID:'',TURNSTILE_SITE_KEY:'1x00000000000000000000AA',GOOGLE_CLIENT_ID:'client',STRIPE_ENABLED:'true'}).length).toBeGreaterThanOrEqual(6);
 expect(configurationErrors({...env,BETTER_AUTH_URL:'https://other.example.com'})).toContain('BETTER_AUTH_URL must match SITE_URL');
});
