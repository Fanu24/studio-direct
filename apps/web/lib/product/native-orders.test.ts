import {beforeEach,afterEach,expect,it} from 'vitest';
import {DEFAULT_JOB_ADDONS,effectiveProductFlags,pricing} from '@gaming/shared';
import {testDatabase} from '../test-db';
import {createNativeOrder} from './native-orders';
import {fulfillEmployerOrder,type PaidSession} from '../billing/employer-orders';
import {companyAccountActive,companyIsClaimed} from './company-claims';
import {reversePayment} from '../billing/reversals';
import {getJobBySlug,listJobs,listCompanies,tagSalaryRange,resolveSalaryStats} from '../jobs/queries';
import {buildJobPostingJsonLd} from '../jobs/jsonld';
let state:ReturnType<typeof testDatabase>;
const now=new Date(),tenantId='tenant:gaming',userId='buyer';
const flags=effectiveProductFlags({PRODUCT_POSTING_V2:true});
const description='Build reliable blockchain infrastructure, collaborate with security engineers, document design decisions and improve the reliability of our public APIs. You will review code, write meaningful integration tests and support releases.';
const listing={title:'Protocol Engineer',descriptionHtml:`<p>${description}</p>`,companyId:null,companyName:'Native Fixture',companyUrl:'https://example.com',
  salaryMin:4000.50,salaryMax:6000,salaryCurrency:'EUR',salaryPeriod:'monthly',cryptoPaymentAvailable:true,workArrangement:'remote',cityIds:[],eligibility:{mode:'geo',regionIds:['country:IT']},
  requiredSkillIds:['skill:rust'],preferredSkillIds:[],languages:[{code:'en',level:'C1',kind:'required'}],benefitSlugs:['health-insurance'],applyMode:'email',applicationsEmail:'hiring@example.com',companyX:'',companyLinkedin:''};
beforeEach(()=>{
  state=testDatabase();state.sql.exec(`INSERT INTO users(id,tenant_id,email,email_verified,name,created_at) VALUES('buyer','tenant:gaming','buyer@example.com',1,'Buyer','2026-01-01');
    INSERT INTO skills(id,slug,name,category,created_at) VALUES('skill:rust','rust','Rust','development','2026-01-01');
    INSERT OR IGNORE INTO benefits(slug,label) VALUES('health-insurance','Health insurance');
    INSERT INTO reference_languages VALUES('en','English','English');
    INSERT INTO reference_countries VALUES('IT','Italy','EU');
    INSERT INTO regions VALUES('country:IT','Italy','country','["IT"]');`);
});
afterEach(()=>state.sql.close());
async function order(id='native-order',addons={...DEFAULT_JOB_ADDONS}) {
  const order=await createNativeOrder(state.db,{id,tenantId,userId,listing,addons,flags},now);
  state.sql.prepare('UPDATE employer_orders SET stripe_session_id=? WHERE id=?').run('cs_'+id,id);return order;
}
const paid=(id:string,total:number):PaidSession=>({id:'cs_'+id,metadata:{orderId:id},payment_status:'paid',currency:'usd',amount_subtotal:total,amount_total:total,payment_intent:'pi_'+id});
it('keeps a new company private and the company account inactive until confirmed payment',async()=>{
  const created=await order();expect(created.total_cents).toBe(pricing.jobPost.base);
  expect(state.sql.prepare('SELECT listed,pending_publication FROM companies').get()).toMatchObject({listed:0,pending_publication:1});
  expect(await companyAccountActive(state.db,tenantId,userId)).toBe(false);
  expect(await fulfillEmployerOrder(state.db,{...paid(created.id,created.total_cents),payment_status:'unpaid'},'unpaid',now)).toBe(false);
  expect(state.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n).toBe(0);
});
it('publishes structured native fields once, activates the buyer and includes an unverified claim',async()=>{
  const created=await order('native-order',{...DEFAULT_JOB_ADDONS,pinDays:3});
  expect(await fulfillEmployerOrder(state.db,paid(created.id,created.total_cents),'paid',now)).toBe(true);
  expect(await fulfillEmployerOrder(state.db,paid(created.id,created.total_cents),'duplicate',now)).toBe(false);
  const job=state.sql.prepare('SELECT * FROM jobs').get();
  expect(job).toMatchObject({commercial_origin:'native',salary_currency:'EUR',salary_period:'monthly',salary_min:listing.salaryMin,crypto_payment_available:1,description_text:description});
  expect(job.pinned_until).toBe(new Date(now.getTime()+3*86400000).toISOString());
  expect(job.expires_at).toBe(new Date(now.getTime()+pricing.jobPost.durationDays*86400000).toISOString());
  expect(state.sql.prepare('SELECT * FROM employer_listings').get()).toMatchObject({apply_mode:'internal',contact_email:'hiring@example.com'});
  expect(state.sql.prepare('SELECT COUNT(*) n FROM job_skills').get().n).toBe(1);
  expect(state.sql.prepare('SELECT COUNT(*) n FROM job_language_requirements').get().n).toBe(1);
  expect(state.sql.prepare('SELECT COUNT(*) n FROM native_listing_details').get().n).toBe(1);
  expect(await companyAccountActive(state.db,tenantId,userId)).toBe(true);
  expect(await companyIsClaimed(state.db,tenantId,job.company_id)).toBe(false);
});
it('handles a refund before or after a native payment without leaving public jobs or paid access',async()=>{
  const created=await order();await reversePayment(state.db,'pi_'+created.id,'refund',now);
  expect(await fulfillEmployerOrder(state.db,paid(created.id,created.total_cents),'paid',now)).toBe(false);
  expect(state.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n).toBe(0);
  expect(await companyAccountActive(state.db,tenantId,userId)).toBe(false);
  const second=await order('another');await fulfillEmployerOrder(state.db,paid(second.id,second.total_cents),'paid2',now);
  await reversePayment(state.db,'pi_'+second.id,'refund2',now);
  expect(state.sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);
  expect(await companyAccountActive(state.db,tenantId,userId)).toBe(false);
});
it('does not sell unfinished early-access/confidential delivery or trust a different order payload',async()=>{
  await expect(order('early',{...DEFAULT_JOB_ADDONS,earlyAccess:true})).rejects.toThrow('not available');
  await expect(order('private',{...DEFAULT_JOB_ADDONS,confidential:true})).rejects.toThrow('not available');
  await order();
  await expect(createNativeOrder(state.db,{id:'native-order',tenantId,userId,listing:{...listing,title:'A changed job'},addons:DEFAULT_JOB_ADDONS,flags},now)).rejects.toThrow('Submission ID');
});
it('redacts hidden compensation from job details, listing payloads and structured data while retaining the private range',async()=>{
  const created=await order('hidden',{...DEFAULT_JOB_ADDONS,hideSalary:true});
  await fulfillEmployerOrder(state.db,paid(created.id,created.total_cents),'hidden-paid',now);
  const raw=state.sql.prepare('SELECT * FROM jobs').get();expect(raw.salary_min).toBe(listing.salaryMin);
  const detail=await getJobBySlug(state.db,tenantId,raw.slug);
  expect(detail).toMatchObject({salaryMin:null,salaryMax:null,salaryText:'Not disclosed',hideSalary:1});
  const result=await listJobs(state.db,tenantId,{});
  expect(result.jobs[0]).toMatchObject({salaryMin:null,salaryMax:null,cryptoPaymentAvailable:1});
  expect(buildJobPostingJsonLd(detail!,'https://nodework.example.com')).not.toHaveProperty('baseSalary');
  expect(JSON.stringify(detail)).not.toContain(String(listing.salaryMin));
  expect(JSON.stringify(detail)).not.toContain(listing.applicationsEmail);
  expect(detail?.requirements).toMatchObject({requiredSkills:['skill:rust'],languages:[{code:'en',level:'C1',kind:'required'}]});
});
it('uses the original currency and period in structured data and annual USD only for salary filtering',async()=>{
  const created=await order();await fulfillEmployerOrder(state.db,paid(created.id,created.total_cents),'paid',now);
  const raw=state.sql.prepare('SELECT slug FROM jobs').get(),detail=await getJobBySlug(state.db,tenantId,raw.slug);
  expect(buildJobPostingJsonLd(detail!,'https://nodework.example.com')).toMatchObject({baseSalary:{currency:'EUR',value:{unitText:'MONTH',minValue:listing.salaryMin}}});
  expect((await listJobs(state.db,tenantId,{salaryMin:50000})).total).toBe(0);
  state.sql.prepare('INSERT INTO fx_rates VALUES(?,?,?,?)').run('EUR',1.2,now.toISOString(),'fixture');
  expect((await listJobs(state.db,tenantId,{salaryMin:50000})).total).toBe(1);
  expect((await listJobs(state.db,tenantId,{salaryMin:100000})).total).toBe(0);
  expect((await listJobs(state.db,tenantId,{cryptoPayment:true})).total).toBe(1);
});
it('excludes every native job from scraped salary statistics, including visible and hidden salaries',async()=>{
  state.sql.prepare('INSERT INTO fx_rates VALUES(?,?,?,?)').run('EUR',1.2,now.toISOString(),'fixture');
  for(let i=0;i<6;i++){
    const created=await order('cohort-'+i,{...DEFAULT_JOB_ADDONS,hideSalary:i%2===0});
    await fulfillEmployerOrder(state.db,paid(created.id,created.total_cents),'cohort-paid-'+i,now);
  }
  expect((await listCompanies(state.db,tenantId))[0].avgSalary).toBeNull();
  expect(await tagSalaryRange(state.db,tenantId,'rust')).toEqual({min:null,max:null,count:0});
  expect(await resolveSalaryStats(state.db,tenantId,'role','rust-developer')).toBeNull();
  // Change fixture provenance to model a mixed catalog: only the external cohort counts.
  state.sql.exec("UPDATE jobs SET commercial_origin='aggregated',hide_salary=0 WHERE id='paid:cohort-5'");
  expect(await tagSalaryRange(state.db,tenantId,'rust')).toEqual({min:null,max:null,count:0});
  expect((await listJobs(state.db,tenantId,{aggregatedOnly:true})).total).toBe(0);
  state.sql.exec("UPDATE jobs SET commercial_origin='aggregated',source='career_page',hide_salary=0 WHERE id IN ('paid:cohort-0','paid:cohort-1','paid:cohort-2','paid:cohort-3')");
  expect(await tagSalaryRange(state.db,tenantId,'rust')).toEqual({min:null,max:null,count:4});
  state.sql.exec("UPDATE jobs SET commercial_origin='aggregated',source='career_page',hide_salary=0 WHERE id='paid:cohort-4'");
  const range=await tagSalaryRange(state.db,tenantId,'rust');
  expect(range.count).toBe(5);expect(range.min).toBeCloseTo(listing.salaryMin*12*1.2);expect(range.max).toBeCloseTo(listing.salaryMax*12*1.2);
  expect((await listCompanies(state.db,tenantId))[0].avgSalary).toBe(Math.round((listing.salaryMin+listing.salaryMax)/2*12*1.2));
  state.sql.exec("UPDATE jobs SET commercial_origin='native_ats' WHERE id='paid:cohort-4'");
  expect(await resolveSalaryStats(state.db,tenantId,'role','rust-developer')).toBeNull();
});
it('pins native jobs by expiration, removes highlighting when a pin expires and never promotes aggregate pins',async()=>{
  for(const [id,pinDays] of [['short',1],['long',7],['regular',0]] as const){
    const created=await order(id,{...DEFAULT_JOB_ADDONS,pinDays});await fulfillEmployerOrder(state.db,paid(created.id,created.total_cents),'paid-'+id,now);
  }
  let result=await listJobs(state.db,tenantId,{});expect(result.jobs.slice(0,2).map(job=>job.id)).toEqual(['paid:long','paid:short']);
  state.sql.exec("UPDATE jobs SET pinned_until='2000-01-01',featured_until='2000-01-01' WHERE id='paid:long'");
  result=await listJobs(state.db,tenantId,{});expect(result.jobs[0].id).toBe('paid:short');expect(result.jobs.find(job=>job.id==='paid:long')?.highlight).toBe(0);
  state.sql.exec("UPDATE jobs SET commercial_origin='aggregated' WHERE id='paid:short'");
  result=await listJobs(state.db,tenantId,{});expect(result.jobs.find(job=>job.id==='paid:short')).toMatchObject({highlight:0,featuredUntil:null});
});
