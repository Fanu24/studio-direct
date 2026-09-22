import { createRequire } from 'node:module';
import { readFileSync,readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach,describe,expect,it } from 'vitest';
import {createEmployerOrder,fulfillEmployerOrder,redeemCredit,renewEmployerListing,type PaidSession} from './employer-orders';
import {DEFAULT_SELECTION,parseSelection,quoteListing} from './listing-catalog';
import type {Database} from '../platform';
import type {ListingInput} from './listing-input';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite');
let sql:any,db:Database;
const listing:ListingInput={title:'Solidity Engineer',descriptionHtml:'<p>Build and audit smart contracts.</p>',companyName:'Fixture Labs',companyUrl:'https://example.com',
  location:'Remote',remote:'remote',applyMode:'external',applyUrl:'https://example.com/careers/42',contactEmail:'employer@example.com',
  tags:['solidity'],salaryMin:100000,salaryMax:140000,logoUrl:'',invoiceDetails:''};
const selection={...DEFAULT_SELECTION,logo:false,autoRenew:false};
function session(id:string,total:number):PaidSession{return {id:`cs_${id}`,payment_status:'paid',currency:'usd',amount_subtotal:total,amount_total:total,metadata:{orderId:id},subscription:`sub_${id}`};}
beforeEach(()=>{
  sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
  const dir=fileURLToPath(new URL('../../../../packages/db/migrations',import.meta.url));
  for(const f of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(`${dir}/${f}`,'utf8'));
  sql.exec(`INSERT INTO users(id,tenant_id,email,created_at) VALUES('employer','tenant:gaming','employer@example.com','2026-01-01')`);
  db={prepare(query:string){let args:unknown[]=[];return {bind(...values:unknown[]){args=values;return this;},
    async first<T>(column?:string){const row=sql.prepare(query).get(...args);return (column?row?.[column]:row)??null as T|null;},
    async all<T>(){return {results:sql.prepare(query).all(...args) as T[]};},
    async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};},
    async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
});
async function order(kind:'job'|'bundle'='job',id='order-1'){
  return createEmployerOrder(db,{id,tenantId:'tenant:gaming',userId:'employer',kind,listing:kind==='job'?listing:null,
    selection:{...selection,quantity:kind==='bundle'?2:1}});
}
describe('employer commerce',()=>{
  it('matches the observed default and bundle quotes, rejects malformed selections',()=>{
    expect(quoteListing(DEFAULT_SELECTION).totalCents).toBe(69500);
    expect(quoteListing({...DEFAULT_SELECTION,quantity:2}).totalCents).toBe(111200);
    expect(quoteListing({...DEFAULT_SELECTION,quantity:24}).totalCents).toBe(1017500);
    expect(quoteListing(parseSelection({...DEFAULT_SELECTION,quantity:32},'bundle')).totalCents).toBe(1267700);
    expect(quoteListing(parseSelection({...DEFAULT_SELECTION,quantity:40},'bundle')).totalCents).toBe(1473400);
    expect(quoteListing(parseSelection({...DEFAULT_SELECTION,quantity:50},'bundle')).totalCents).toBe(1563800);
    expect(()=>parseSelection({...DEFAULT_SELECTION,quantity:31},'bundle')).toThrow();
    expect(()=>parseSelection({...DEFAULT_SELECTION,stickyDays:2},'job')).toThrow();
    expect(()=>parseSelection({...DEFAULT_SELECTION,quantity:3},'bundle')).toThrow();
  });
  it('does not publish unpaid orders',async()=>{
    const o=await order();expect(await fulfillEmployerOrder(db,{...session(o.id,o.total_cents),payment_status:'unpaid'},'evt_1')).toBe(false);
    expect(sql.prepare('SELECT COUNT(*) n FROM jobs').get().n).toBe(0);
  });
  it('publishes once, indexes real content, and does not reopen a closed listing on retry',async()=>{
    const o=await order(),s=session(o.id,o.total_cents);
    expect(await fulfillEmployerOrder(db,s,'evt_1')).toBe(true);
    expect(sql.prepare('SELECT status FROM company_claims').get().status).toBe('pending');
    expect(sql.prepare('SELECT COUNT(*) n FROM company_purchase_entitlements').get().n).toBe(1);
    const j=sql.prepare('SELECT * FROM jobs').get();expect(j.title).toBe(listing.title);expect(j.apply_url).toBe(listing.applyUrl);
    expect(sql.prepare("SELECT COUNT(*) n FROM jobs_fts WHERE jobs_fts MATCH 'solidity'").get().n).toBe(1);
    sql.prepare('UPDATE jobs SET listed=0 WHERE id=?').run(j.id);
    expect(await fulfillEmployerOrder(db,s,'evt_retry')).toBe(false);
    expect(sql.prepare('SELECT COUNT(*) n FROM company_claims').get().n).toBe(1);
    expect(sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);
  });
  it('rejects the wrong currency, amount and checkout session',async()=>{
    const o=await order(),s=session(o.id,o.total_cents);
    await expect(fulfillEmployerOrder(db,{...s,currency:'eur'},'evt')).rejects.toThrow('amount mismatch');
    await expect(fulfillEmployerOrder(db,{...s,amount_total:1},'evt')).rejects.toThrow('amount mismatch');
    await db.prepare('UPDATE employer_orders SET stripe_session_id=? WHERE id=?').bind('cs_expected',o.id).run();
    await expect(fulfillEmployerOrder(db,s,'evt')).rejects.toThrow('session mismatch');
  });
  it('honors a verified Stripe discount without trusting a client amount',async()=>{
    const o=await order(),s=session(o.id,o.total_cents);
    expect(await fulfillEmployerOrder(db,{...s,amount_total:o.total_cents-1000,total_details:{amount_discount:1000}},'evt')).toBe(true);
  });
  it('rolls back all publication writes when fulfilment fails',async()=>{
    const o=await order();sql.exec(`CREATE TRIGGER reject_tag BEFORE INSERT ON job_tags BEGIN SELECT RAISE(ABORT,'test failure'); END;`);
    await expect(fulfillEmployerOrder(db,session(o.id,o.total_cents),'evt')).rejects.toThrow('test failure');
    expect(sql.prepare('SELECT COUNT(*) n FROM jobs').get().n).toBe(0);
    expect(sql.prepare('SELECT status FROM employer_orders').get().status).toBe('pending');
    sql.exec('DROP TRIGGER reject_tag');
    expect(await fulfillEmployerOrder(db,session(o.id,o.total_cents),'evt')).toBe(true);
  });
  it('mints bundle credits once and enforces owner, expiry and one-time redemption',async()=>{
    const o=await order('bundle');await fulfillEmployerOrder(db,session(o.id,o.total_cents),'evt',new Date('2026-09-16'));
    await fulfillEmployerOrder(db,session(o.id,o.total_cents),'evt_retry');
    expect(sql.prepare('SELECT COUNT(*) n FROM bundle_credits').get().n).toBe(2);
    await expect(redeemCredit(db,'other',`${o.id}:0`,listing)).rejects.toThrow();
    const id=await redeemCredit(db,'employer',`${o.id}:0`,listing,new Date('2026-09-17'));
    expect(sql.prepare('SELECT job_id FROM bundle_credits WHERE slot=0').get().job_id).toBe(id);
    await expect(redeemCredit(db,'employer',`${o.id}:0`,listing)).rejects.toThrow();
    await expect(redeemCredit(db,'employer',`${o.id}:1`,listing,new Date('2029-01-01'))).rejects.toThrow();
  });
  it('makes renewals idempotent and leaves employer-closed jobs closed',async()=>{
    const o=await order();await fulfillEmployerOrder(db,session(o.id,o.total_cents),'evt',new Date('2026-09-01'));
    await renewEmployerListing(db,`sub_${o.id}`,'renew',new Date('2026-10-01'));
    await renewEmployerListing(db,`sub_${o.id}`,'renew',new Date('2026-10-05'));
    expect(sql.prepare('SELECT expires_at FROM employer_listings').get().expires_at).toBe('2026-10-31T00:00:00.000Z');
    sql.exec("UPDATE employer_listings SET closed_at='2026-10-02'; UPDATE jobs SET listed=0");
    await renewEmployerListing(db,`sub_${o.id}`,'renew2',new Date('2026-11-01'));
    expect(sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);
  });
});
