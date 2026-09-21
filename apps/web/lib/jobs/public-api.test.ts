import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {testDatabase} from '../test-db';
import {createApiKey,authorizeApiKey,revokeApiKey,listApiKeys} from './api-keys';
import {apiFilters,publicJobsApi} from './public-api';
import {createEmployerOrder,fulfillEmployerOrder} from '../billing/employer-orders';
import {DEFAULT_SELECTION} from '../billing/listing-catalog';
import {parseListing} from '../billing/listing-input';
import type {PlatformEnv} from '../platform';
vi.mock('../platform',async importOriginal=>({...await importOriginal<typeof import('../platform')>(),platform:vi.fn(),appOrigin:()=> 'https://jobs.example.com'}));
let state:ReturnType<typeof testDatabase>;
beforeEach(()=>{state=testDatabase();state.sql.exec("INSERT INTO users(id,tenant_id,email,created_at) VALUES('api-user','tenant:gaming','api@example.test','2026-09-21'),('other','tenant:gaming','other@example.test','2026-09-21')");});
afterEach(()=>state.sql.close());
it('stores only hashed keys, enforces ownership and removes access when the owner is deleted',async()=>{
 const issued=await createApiKey(state.db,'api-user','https://example.com');
 const row=state.sql.prepare('SELECT * FROM jobs_api_keys').get();expect(row.token_hash).not.toBe(issued.token);expect(JSON.stringify(await listApiKeys(state.db,'api-user'))).not.toContain(row.token_hash);
 await revokeApiKey(state.db,'other',issued.id);expect((await authorizeApiKey(state.db,issued.token)).ok).toBe(true);
 state.sql.exec("DELETE FROM users WHERE id='api-user'");expect(await authorizeApiKey(state.db,issued.token)).toEqual({ok:false,status:401});
});
it('enforces five active keys and the atomic per-minute allowance, then resets and revokes',async()=>{
 const first=await createApiKey(state.db,'api-user','https://example.com');for(let i=0;i<4;i++)await createApiKey(state.db,'api-user','https://example.com');
 await expect(createApiKey(state.db,'api-user','https://example.com')).rejects.toThrow('maximum 5');
 const now=Date.parse('2026-09-21T10:00:15Z'),results=await Promise.all(Array.from({length:65},()=>authorizeApiKey(state.db,first.token,now)));
 expect(results.filter(r=>r.ok)).toHaveLength(60);expect(results.filter(r=>!r.ok&&r.status===429)).toHaveLength(5);
 expect(await authorizeApiKey(state.db,first.token,now)).toEqual({ok:false,status:429,retryAfter:45});
 expect((await authorizeApiKey(state.db,first.token,now+60000)).ok).toBe(true);
 await revokeApiKey(state.db,'api-user',first.id);expect(await authorizeApiKey(state.db,first.token)).toEqual({ok:false,status:401});
 await expect(createApiKey(state.db,'api-user','https://example.com')).resolves.toHaveProperty('token');
});
it('validates filters and supports country, remote, descriptions and bounded pagination',()=>{
 expect(apiFilters(new URLSearchParams('country=united-states&remote=true&limit=100&show_description=true'))).toMatchObject({filters:{locationSlug:'united-states',remoteOnly:true,pageSize:100},description:true});
 for(const query of ['limit=101','page=-1','remote=maybe','salary_min=500&salary_max=100','tag=not-a-role','country=unknown','show_description=yes'])expect(()=>apiFilters(new URLSearchParams(query))).toThrow();
});
it('serves only live public jobs, filters salary and paginates JSON, with optional description and escaped RSS',async()=>{
 for(let i=0;i<4;i++){
  const order=await createEmployerOrder(state.db,{id:'api-job-'+i,tenantId:'tenant:gaming',userId:'api-user',kind:'job',selection:{...DEFAULT_SELECTION,logo:false,autoRenew:false},listing:parseListing({title:'Solidity engineer '+i,companyName:'QA & Company',companyUrl:'https://example.com',location:'New York, United States',remote:'remote',applyMode:'internal',salaryMin:100000+i*10000,salaryMax:120000+i*10000,descriptionHtml:'<p>'+ 'Build Web3 tools. '.repeat(12)+'</p>',primarySkill:'solidity'},'api@example.test')});
  await fulfillEmployerOrder(state.db,{id:'cs-'+i,payment_status:'paid',currency:'usd',amount_subtotal:order.total_cents,amount_total:order.total_cents,metadata:{orderId:order.id}},'checkout');
 }
 state.sql.exec("UPDATE jobs SET listed=0 WHERE id='paid:api-job-2'; UPDATE jobs SET expires_at='2000-01-01' WHERE id='paid:api-job-3'");
 const env={DB:state.db} as PlatformEnv,key=await createApiKey(state.db,'api-user','https://example.com');
 const request=(query='')=>new Request('https://jobs.example.com/api/v1?'+query,{headers:{Authorization:'Bearer '+key.token}});
 const unauthorized=await publicJobsApi(new Request('https://jobs.example.com/api/v1'),'json',env);expect(unauthorized.status).toBe(401);
 const first=await publicJobsApi(request('limit=1&show_description=true&country=united-states'),'json',env),payload=await first.json();expect(payload.total).toBe(2);expect(payload.jobs).toHaveLength(1);expect(payload.jobs[0].description).toContain('Build Web3 tools');expect(payload.jobs[0]).not.toHaveProperty('user_id');expect(payload.jobs[0]).not.toHaveProperty('email');
 const second=await (await publicJobsApi(request('limit=1&page=2'),'json',env)).json();expect(second.jobs[0].id).not.toBe(payload.jobs[0].id);expect(second.jobs[0]).not.toHaveProperty('description');
 expect((await (await publicJobsApi(request('salary_min=125000'),'json',env)).json()).total).toBe(1);
 const rss=await publicJobsApi(new Request('https://jobs.example.com/api/v1.xml?token='+key.token),'rss',env);expect(rss.headers.get('Content-Type')).toContain('rss+xml');expect(await rss.text()).toContain('QA &amp; Company');
 await revokeApiKey(state.db,'api-user',key.id);expect((await publicJobsApi(request(),'json',env)).status).toBe(401);
});
