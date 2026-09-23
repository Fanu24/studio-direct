import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {createHmac} from 'node:crypto';
import {DEFAULT_JOB_ADDONS,pricing} from '@gaming/shared';
import {testDatabase} from '../../../../../lib/test-db';
import {companyAccountActive,companyIsClaimed} from '../../../../../lib/product/company-claims';
import {getJobBySlug} from '../../../../../lib/jobs/queries';
import {ownedNativeListing} from '../../../../../lib/product/native-listings';
const runtime=vi.hoisted(()=>({env:{} as Record<string,any>,user:null as {id:string;email:string;emailVerified:boolean}|null}));
vi.mock('../../../../../lib/platform',()=>({platform:async()=>runtime.env,currentUser:async()=>runtime.user,sameOrigin:(r:Request)=>r.headers.get('origin')===new URL(r.url).origin,appOrigin:()=>runtime.env.SITE_URL}));
vi.mock('@opennextjs/cloudflare',()=>({getCloudflareContext:async()=>({env:runtime.env})}));
import {POST as checkout} from './route';
import {POST as edit} from '../edit/route';
import {POST as webhook} from '../../../stripe/webhook/route';
let state:ReturnType<typeof testDatabase>;
const origin='https://nodework.example.com',id='12345678-1234-1234-1234-123456789abc',secret='whsec_fixture';
const listing={title:'Protocol Engineer',descriptionHtml:'<p>'+'Build reliable blockchain infrastructure and collaborate with engineers on security reviews. '.repeat(3)+'</p>',companyId:null,companyName:'Checkout Fixture',companyUrl:'https://example.com',salaryMin:5000,salaryMax:7000,salaryCurrency:'EUR',salaryPeriod:'monthly',cryptoPaymentAvailable:true,workArrangement:'remote',cityIds:[],eligibility:{mode:'geo',regionIds:['country:IT']},requiredSkillIds:['rust'],preferredSkillIds:[],languages:[{code:'en',level:'C1',kind:'required'}],benefitSlugs:[],applyMode:'email',applicationsEmail:'hiring@example.com',companyX:'',companyLinkedin:''};
const request=(body:unknown)=>new Request(origin+'/api/product/jobs/checkout',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const payload=()=>({id,listing,addons:{...DEFAULT_JOB_ADDONS,hideSalary:true,pinDays:3},total_cents:1});
const total=()=>pricing.jobPost.base+pricing.addons.hideSalary+pricing.addons.pin[3];
const session=()=>({id:'cs_job',livemode:false,metadata:{orderId:id},payment_status:'paid',currency:'usd',amount_subtotal:total(),amount_total:total()-1000,total_details:{amount_discount:1000,amount_tax:0},payment_intent:'pi_job'});
function signed(type:string,object:unknown,eventId='evt_'+type){
  const timestamp=Math.floor(Date.now()/1000),body=JSON.stringify({id:eventId,type,data:{object}}),signature=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex');
  return new Request(origin+'/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${signature}`},body});
}
beforeEach(()=>{
  state=testDatabase();state.sql.exec(`INSERT INTO users(id,tenant_id,email,email_verified,name,created_at) VALUES('buyer','tenant:gaming','buyer@example.com',1,'Buyer','2026-01-01');
    INSERT INTO skills(id,slug,name,category,created_at) VALUES('rust','rust','Rust','development','2026-01-01');
    INSERT INTO reference_languages VALUES('en','English','English');INSERT INTO reference_countries VALUES('IT','Italy','EU');INSERT INTO regions VALUES('country:IT','Italy','country','["IT"]');`);
  runtime.env={DB:state.db,SITE_URL:origin,STRIPE_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:secret,PRODUCT_POSTING_V2:'true'};
  runtime.user={id:'buyer',email:'buyer@example.com',emailVerified:true};
});
afterEach(()=>{state.sql.close();vi.unstubAllGlobals();});
it('quotes each option on the server, publishes once from a signed paid event, edits without rebilling and revokes on refund',async()=>{
  const fetcher=vi.fn(async(_url:string,init:RequestInit)=>{
    const params=init.body as URLSearchParams;
    expect(params.get('mode')).toBe('payment');expect(params.get('success_url')).toContain('/employer/purchase?order=');
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe(String(pricing.jobPost.base));
    expect(params.get('line_items[1][price_data][unit_amount]')).toBe(String(pricing.addons.hideSalary));
    expect(params.get('line_items[2][price_data][unit_amount]')).toBe(String(pricing.addons.pin[3]));
    return Response.json({id:'cs_job',url:'https://checkout.stripe.com/c/pay/cs_job',livemode:false});
  });vi.stubGlobal('fetch',fetcher);
  expect((await checkout(request(payload()))).status).toBe(200);
  expect(await companyAccountActive(state.db,'tenant:gaming','buyer')).toBe(false);
  expect((await webhook(signed('checkout.session.completed',session()))).status).toBe(200);
  expect((await webhook(signed('checkout.session.completed',session(),'evt_duplicate'))).status).toBe(200);
  expect(state.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n).toBe(1);
  const job=state.sql.prepare('SELECT * FROM jobs').get();
  expect(job.location).toBe('Remote · Italy');expect((await getJobBySlug(state.db,'tenant:gaming',job.slug))?.salaryMin).toBeNull();
  expect(await companyAccountActive(state.db,'tenant:gaming','buyer')).toBe(true);expect(await companyIsClaimed(state.db,'tenant:gaming',job.company_id)).toBe(false);
  const owned=await ownedNativeListing(state.db,'buyer',job.id);
  expect((await edit(request({jobId:job.id,listing:{...owned!.input,title:'Senior Protocol Engineer',salaryMin:6000}}))).status).toBe(200);
  expect(state.sql.prepare('SELECT * FROM jobs').get()).toMatchObject({title:'Senior Protocol Engineer',salary_min:6000,salary_text:'Not disclosed',pinned_until:job.pinned_until,expires_at:job.expires_at,slug:job.slug});
  runtime.user={id:'stranger',email:'stranger@example.com',emailVerified:true};expect((await edit(request({jobId:job.id,listing:owned!.input}))).status).toBe(400);
  runtime.user={id:'buyer',email:'buyer@example.com',emailVerified:true};
  expect((await webhook(signed('charge.refunded',{refunded:true,payment_intent:'pi_job'}))).status).toBe(200);
  expect(await companyAccountActive(state.db,'tenant:gaming','buyer')).toBe(false);
  expect((await edit(request({jobId:job.id,listing:owned!.input}))).status).toBe(400);
});
it('rejects invalid origin, unpaid identity, disabled offer and live Stripe configuration',async()=>{
  expect((await checkout(new Request(origin,{method:'POST',body:'{}'}))).status).toBe(403);
  runtime.user=null;expect((await checkout(request(payload()))).status).toBe(401);
  runtime.user={id:'buyer',email:'buyer@example.com',emailVerified:true};runtime.env.PRODUCT_POSTING_V2='false';expect((await checkout(request(payload()))).status).toBe(404);
  runtime.env.PRODUCT_POSTING_V2='true';runtime.env.STRIPE_SECRET_KEY='sk_live_fixture';expect((await checkout(request(payload()))).status).toBe(503);
  runtime.env.STRIPE_SECRET_KEY='sk_test_fixture';state.sql.exec("UPDATE users SET email_verified=0");expect((await checkout(request(payload()))).status).toBe(400);
});
it('returns field errors before contacting Stripe and rejects live checkout responses',async()=>{
  const fetcher=vi.fn(async()=>Response.json({id:'cs_live',url:'https://checkout.stripe.com/c/pay/cs_live',livemode:true}));vi.stubGlobal('fetch',fetcher);
  const invalid=await checkout(request({...payload(),listing:{...listing,descriptionHtml:'Too short'}}));expect(invalid.status).toBe(400);expect((await invalid.json()).fields).toHaveProperty('descriptionHtml');expect(fetcher).not.toHaveBeenCalled();
  expect((await checkout(request(payload()))).status).toBe(502);expect(state.sql.prepare('SELECT stripe_session_id FROM employer_orders').get().stripe_session_id).toBeNull();
});
it('reconciles only the authenticated buyer and verifies the provider session, discount and payment',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    if(url.endsWith('/checkout/sessions'))return Response.json({id:'cs_job',url:'https://checkout.stripe.com/c/pay/cs_job',livemode:false});
    if(url.includes('payment_intents'))return Response.json({id:'pi_job',latest_charge:{refunded:false}});
    return Response.json(session());
  }));
  expect((await checkout(request(payload()))).status).toBe(200);
  runtime.user={id:'stranger',email:'stranger@example.com',emailVerified:true};expect((await checkout(request({id,action:'reconcile'}))).status).toBe(404);
  runtime.user={id:'buyer',email:'buyer@example.com',emailVerified:true};const checked=await checkout(request({id,action:'reconcile'}));expect(checked.status).toBe(200);expect(await checked.json()).toEqual({status:'paid'});
});
it('resumes one existing checkout and permits a fresh order only after confirmed expiry',async()=>{
  let status='open',creates=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    if(url.endsWith('/checkout/sessions')){creates++;return Response.json({id:'cs_job',url:'https://checkout.stripe.com/c/pay/cs_job',livemode:false});}
    return Response.json({...session(),status,payment_status:'unpaid',payment_intent:null,url:'https://checkout.stripe.com/c/pay/cs_job'});
  }));
  expect((await checkout(request(payload()))).status).toBe(200);
  expect((await (await checkout(request(payload()))).json()).url).toContain('checkout.stripe.com');expect(creates).toBe(1);
  status='complete';expect((await (await checkout(request(payload()))).json()).url).toContain('/employer/purchase?order=');expect(creates).toBe(1);
  status='expired';const expired=await checkout(request(payload()));expect(expired.status).toBe(409);expect((await expired.json()).restart).toBe(true);
  expect(state.sql.prepare('SELECT status FROM employer_orders').get().status).toBe('cancelled');expect(creates).toBe(1);
  expect(state.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n).toBe(0);expect(await companyAccountActive(state.db,'tenant:gaming','buyer')).toBe(false);
});
it('handles signed expiry only for the bound pending session and keeps paid orders paid',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'cs_job',url:'https://checkout.stripe.com/c/pay/cs_job',livemode:false})));
  await checkout(request(payload()));await webhook(signed('checkout.session.expired',{...session(),id:'cs_other'}));
  expect(state.sql.prepare('SELECT status FROM employer_orders').get().status).toBe('pending');
  await webhook(signed('checkout.session.completed',session()));await webhook(signed('checkout.session.expired',session()));
  expect(state.sql.prepare('SELECT status FROM employer_orders').get().status).toBe('paid');
});
