import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {deliverNotifications} from '@gaming/shared';
import {testDatabase} from '../test-db';
import {createEmployerOrder,fulfillEmployerOrder} from '../billing/employer-orders';
import {DEFAULT_SELECTION} from '../billing/listing-catalog';
import {parseListing} from '../billing/listing-input';
import {editListing,ownedListing} from '../billing/listing-management';
import {submitCandidateApplication,applicationFile,updateApplication} from './candidate-applications';
let state:ReturnType<typeof testDatabase>,jobId:string;
const input=()=>parseListing({title:'Web3 engineer',companyName:'Test Company',companyUrl:'https://example.com',location:'Worldwide',remote:'remote',applyMode:'internal',descriptionHtml:'<p>'+ 'A meaningful job description for testing only. '.repeat(4)+'</p>',primarySkill:'solidity',benefits:['PTO'],tags:[]},'employer@example.test');
const files={put:vi.fn(),get:vi.fn(),delete:vi.fn()};
beforeEach(async()=>{state=testDatabase();vi.clearAllMocks();state.sql.exec(`INSERT INTO users(id,tenant_id,email,created_at) VALUES('employer','tenant:gaming','employer@example.test','2026-09-19'),('candidate','tenant:gaming','candidate@example.test','2026-09-19'),('stranger','tenant:gaming','stranger@example.test','2026-09-19');`);
 state.sql.exec("UPDATE users SET email_verified=1");
 const o=await createEmployerOrder(state.db,{id:'testorder',tenantId:'tenant:gaming',userId:'employer',kind:'job',listing:input(),selection:{...DEFAULT_SELECTION,logo:false,autoRenew:false}});
 await fulfillEmployerOrder(state.db,{id:'cs',payment_status:'paid',currency:'usd',amount_subtotal:o.total_cents,amount_total:o.total_cents,metadata:{orderId:o.id}},'checkout');jobId='paid:testorder';
});
afterEach(()=>state.sql.close());
const form=()=>{const f=new FormData();f.set('jobId',jobId);f.set('name','Candidate QA');f.set('email','spoof@example.test');f.set('cv',new File(['%PDF-1.7\nfixture'],'cv.pdf',{type:'application/pdf'}));return f;};
it('edits owned content and skills without extending expiry or changing slug and paid placement',async()=>{
 const before=state.sql.prepare('SELECT slug,expires_at,featured_until FROM jobs WHERE id=?').get(jobId);
 await expect(editListing(state.db,'stranger',jobId,input())).rejects.toThrow('not found');
 await editListing(state.db,'employer',jobId,{...input(),title:'Updated title',tags:['rust'],primarySkill:'rust',benefits:['Learning budget'],location:'New York, United States'});
 expect(state.sql.prepare('SELECT slug,expires_at,featured_until FROM jobs WHERE id=?').get(jobId)).toEqual(before);
 expect((await ownedListing(state.db,'employer',jobId))?.input).toMatchObject({title:'Updated title',tags:['rust'],benefits:['Learning budget'],location:'New York, United States'});
 expect(state.sql.prepare('SELECT benefit_slug FROM job_benefits WHERE job_id=?').get(jobId).benefit_slug).toBe('learning-budget');
 expect(state.sql.prepare('SELECT location_slug FROM job_locations WHERE job_id=? ORDER BY location_slug').all(jobId).map((r:any)=>r.location_slug)).toEqual(['new-york','north-america','united-states']);
 expect(state.sql.prepare('SELECT tag_slug FROM job_tags WHERE job_id=? ORDER BY tag_slug').all(jobId).map((r:any)=>r.tag_slug)).toEqual(['learning-budget','rust']);
});
it('sanitizes content, requires an explicit valid main skill and validates company social links',()=>{
 expect(parseListing({...input(),descriptionHtml:'<script>alert(1)</script>'+input().descriptionHtml},'qa@example.test').descriptionHtml).not.toContain('<script>');
 expect(()=>parseListing({...input(),primarySkill:'unknown'},'qa@example.test')).toThrow('main skill');
 expect(()=>parseListing({...input(),twitterUrl:'https://evil.example'},'qa@example.test')).toThrow('Twitter');
});
it('stores one application and private CV, using verified identity instead of submitted email',async()=>{
 const env={DB:state.db,FILES:files},candidate={id:'candidate',email:'candidate@example.test'};
 await submitCandidateApplication(env,candidate,'tenant:gaming',form());await submitCandidateApplication(env,candidate,'tenant:gaming',form());
 const rows=state.sql.prepare('SELECT * FROM job_applications').all();expect(rows).toHaveLength(1);expect(rows[0].email).toBe(candidate.email);expect(files.put).toHaveBeenCalledTimes(1);
 expect(await applicationFile(state.db,'candidate',rows[0].id)).toBe(rows[0].cv_r2_key);expect(await applicationFile(state.db,'employer',rows[0].id)).toBe(rows[0].cv_r2_key);expect(await applicationFile(state.db,'stranger',rows[0].id)).toBeNull();
 expect(state.sql.prepare('SELECT COUNT(*) n FROM notification_outbox').get().n).toBe(2);
 await expect(updateApplication(state.db,'stranger',rows[0].id,'hired','')).rejects.toThrow();
 await updateApplication(state.db,'employer',rows[0].id,'reviewed','Private note');expect(state.sql.prepare('SELECT status FROM job_applications').get().status).toBe('reviewed');
 state.sql.exec("UPDATE job_applications SET status='withdrawn'");expect(await applicationFile(state.db,'employer',rows[0].id)).toBeNull();
 await expect(submitCandidateApplication(env,candidate,'tenant:gaming',form())).rejects.toThrow('You withdrew this application');
 expect(files.put).toHaveBeenCalledTimes(1);
 await expect(updateApplication(state.db,'employer',rows[0].id,'hired','')).rejects.toThrow();
});
it('rejects disguised documents and applications to closed jobs before storing files',async()=>{
 const f=form();f.set('cv',new File(['not a PDF'],'cv.pdf',{type:'application/pdf'}));
 await expect(submitCandidateApplication({DB:state.db,FILES:files},{id:'candidate',email:'candidate@example.test'},'tenant:gaming',f)).rejects.toThrow('valid PDF');
 state.sql.exec('UPDATE jobs SET listed=0');await expect(submitCandidateApplication({DB:state.db,FILES:files},{id:'candidate',email:'candidate@example.test'},'tenant:gaming',form())).rejects.toThrow('closed');expect(files.put).not.toHaveBeenCalled();
});
it('retains failed email delivery for retry and does not send twice in a successful pass',async()=>{
 await submitCandidateApplication({DB:state.db,FILES:files},{id:'candidate',email:'candidate@example.test'},'tenant:gaming',form());
 const send=vi.fn().mockRejectedValueOnce(Error('provider unavailable')).mockResolvedValue({});const env={DB:state.db,EMAIL:{send},EMAIL_ENABLED:'true',EMAIL_FROM:'mail@example.test',SITE_URL:'https://example.test'};
 const now=new Date();expect((await deliverNotifications(env,now)).failed).toBe(1);expect(state.sql.prepare('SELECT sent_at FROM notification_outbox').get().sent_at).toBeNull();
 expect((await deliverNotifications(env,new Date(now.getTime()+600000))).sent).toBe(1);await deliverNotifications(env,new Date(now.getTime()+1200000));expect(send).toHaveBeenCalledTimes(3);
 expect(send.mock.calls[2][0].to).toBe(send.mock.calls[0][0].to);expect(new Set(send.mock.calls.map(c=>c[0].to))).toEqual(new Set(['candidate@example.test','employer@example.test']));for(const [mail] of send.mock.calls)expect(mail.text).not.toContain('applications/candidate');
});
