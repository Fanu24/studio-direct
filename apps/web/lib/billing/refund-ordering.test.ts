import {afterEach,beforeEach,expect,it} from 'vitest';
import {testDatabase} from '../test-db';
import {createEmployerOrder,fulfillEmployerOrder,redeemCredit,type PaidSession} from './employer-orders';
import {DEFAULT_SELECTION} from './listing-catalog';
import {createMarketOrder,fulfillMarketOrder,hasRecruiterAccess} from './marketplace';
import {reversePayment} from './reversals';
import type {ListingInput} from './listing-input';

let state:ReturnType<typeof testDatabase>;
const listing:ListingInput={title:'Sandbox engineer',companyName:'Fixture',companyUrl:'https://example.com',descriptionHtml:'<p>Test vacancy only.</p>',
 location:'Worldwide',remote:'remote',applyMode:'external',applyUrl:'https://example.com/jobs',contactEmail:'qa@example.test',tags:['web3'],salaryMin:null,salaryMax:null,logoUrl:'',invoiceDetails:''};
const selection={...DEFAULT_SELECTION,logo:false,autoRenew:false};
beforeEach(()=>{
 state=testDatabase();state.sql.exec(`INSERT INTO users(id,tenant_id,email,created_at) VALUES('qa','tenant:gaming','qa@example.test','2026-09-19');
 INSERT INTO recruiter_accounts VALUES('qa','Fixture','https://example.com','verified','2026-09-19');
 UPDATE marketplace_settings SET value='19900' WHERE key='recruiter_price_cents';`);
});
afterEach(()=>state.sql.close());

for(const kind of ['job','bundle','sponsor','recruiter'] as const){
 it.each(['before','during','after'] as const)(`never retains ${kind} access when the refund arrives %s checkout fulfilment`,async(timing)=>{
  const {db,sql}=state;
  const employer=kind==='job'||kind==='bundle';
  const order=employer?await createEmployerOrder(db,{id:'order',tenantId:'tenant:gaming',userId:'qa',kind,listing:kind==='job'?listing:null,selection:{...selection,quantity:kind==='bundle'?2:1}})
   :await createMarketOrder(db,{id:'order',userId:'qa',kind,sponsor:kind==='sponsor'?{slot:1,title:'Sandbox banner',subtitle:'Test',url:'https://example.com',color:'#abcdef'}:undefined});
  const session:PaidSession={id:'cs_test',payment_intent:'pi_test',payment_status:'paid',currency:'usd',amount_subtotal:order.total_cents,amount_total:order.total_cents,metadata:employer?{orderId:order.id}:{purchaseId:order.id}};
  const refund=()=>reversePayment(db,'pi_test','evt_refund');
  const fulfill=()=>employer?fulfillEmployerOrder(db,session,'evt_checkout'):fulfillMarketOrder(db,session,'evt_checkout');
  if(timing==='before')await refund();
  if(timing==='during'){
   // Interleave the refund after fulfilment's reads but before its write transaction.
   const batch=db.batch.bind(db);let intercept=true;
   db.batch=async statements=>{if(intercept){intercept=false;await refund();}return batch(statements);};
  }
  await fulfill();
  if(timing==='after')await refund();
  await refund();await fulfill(); // repeated delivery must not reopen access
  expect(sql.prepare(`SELECT status FROM ${employer?'employer_orders':'marketplace_orders'}`).get().status).toBe('refunded');
  expect(sql.prepare('SELECT COUNT(*) n FROM jobs WHERE listed=1').get().n).toBe(0);
  expect(sql.prepare('SELECT COUNT(*) n FROM sponsor_slots WHERE order_id IS NOT NULL').get().n).toBe(0);
  expect(await hasRecruiterAccess(db,'qa')).toBe(false);
  if(kind==='bundle')await expect(redeemCredit(db,'qa','order:0',listing)).rejects.toThrow('unavailable');
  expect(sql.prepare('SELECT COUNT(*) n FROM payment_reversals').get().n).toBe(1);
 });
}

it('does not consume a bundle credit if its payment is refunded after the ownership read',async()=>{
 const {db,sql}=state;
 const order=await createEmployerOrder(db,{id:'order',tenantId:'tenant:gaming',userId:'qa',kind:'bundle',listing:null,selection:{...selection,quantity:2}});
 await fulfillEmployerOrder(db,{id:'cs_test',payment_intent:'pi_test',payment_status:'paid',currency:'usd',amount_subtotal:order.total_cents,amount_total:order.total_cents,metadata:{orderId:'order'}},'evt_checkout');
 const batch=db.batch.bind(db);let intercept=true;
 db.batch=async statements=>{if(intercept){intercept=false;await reversePayment(db,'pi_test','evt_refund');}return batch(statements);};
 await expect(redeemCredit(db,'qa','order:0',listing)).rejects.toThrow();
 expect(sql.prepare('SELECT COUNT(*) n FROM jobs').get().n).toBe(0);
 expect(sql.prepare('SELECT job_id FROM bundle_credits WHERE id=?').get('order:0').job_id).toBeNull();
});
