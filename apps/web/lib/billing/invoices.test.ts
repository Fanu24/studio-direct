import {afterEach,beforeEach,it,expect} from 'vitest';
import {reconcileListingPeriods} from '@gaming/shared';
import {testDatabase} from '../test-db';
import {parseListing} from './listing-input';
import {createEmployerOrder,fulfillEmployerOrder} from './employer-orders';
import {DEFAULT_SELECTION} from './listing-catalog';
import {recordPaidInvoice,resolveInvoice} from './invoices';
import {reversePayment} from './reversals';
let state:ReturnType<typeof testDatabase>;const now=new Date('2026-09-19T12:00:00Z');
const epoch=(s:string)=>Date.parse(s)/1000;
const invoice=(id='in_first',start='2026-09-19',end='2026-10-19')=>({id,orderId:'order',subscription:'sub',customer:'cus',currency:'usd',subtotal:69500,amount_paid:69500,status:'paid',billing_reason:id==='in_first'?'subscription_create':'subscription_cycle',payment_intent:'pi_'+id,lines:{data:[{type:'subscription',period:{start:epoch(start),end:epoch(end)}}],has_more:false}});
const checkout=()=>fulfillEmployerOrder(state.db,{id:'cs',subscription:'sub',customer:'cus',metadata:{orderId:'order'},payment_status:'paid',currency:'usd',amount_subtotal:69500,amount_total:69500},'checkout',now);
beforeEach(async()=>{state=testDatabase();state.sql.exec("INSERT INTO users(id,tenant_id,email,created_at) VALUES('employer','tenant:gaming','qa@example.test','2026-09-19')");
 await createEmployerOrder(state.db,{id:'order',tenantId:'tenant:gaming',userId:'employer',kind:'job',selection:DEFAULT_SELECTION,listing:parseListing({title:'Recurring job',companyName:'Fixture',companyUrl:'https://example.com',location:'Worldwide',remote:'remote',applyMode:'internal',primarySkill:'solidity',descriptionHtml:'Job description '.repeat(15)},'qa@example.test')});
});afterEach(()=>state.sql.close());
it.each(['before','after'])('retains an invoice received %s Checkout and uses its billed period',async(timing)=>{
 if(timing==='before')await recordPaidInvoice(state.db,invoice(),'evt',now);await checkout();if(timing==='after')await recordPaidInvoice(state.db,invoice(),'evt',now);
 expect(state.sql.prepare('SELECT listed,expires_at FROM jobs').get()).toMatchObject({listed:1,expires_at:'2026-10-19T00:00:00.000Z'});
 await recordPaidInvoice(state.db,invoice(),'duplicate',now);expect(state.sql.prepare('SELECT COUNT(*) n FROM listing_invoice_periods').get().n).toBe(1);
});
it('honors an initial refund delivered before either paid event and reopens only on a new paid period',async()=>{
 await reversePayment(state.db,'pi_in_first','refund',now);await recordPaidInvoice(state.db,invoice(),'paid',now);await checkout();expect(state.sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);
 await recordPaidInvoice(state.db,invoice('in_next','2026-10-19','2026-11-18'),'renew',new Date('2026-10-20'));expect(state.sql.prepare('SELECT listed,expires_at FROM jobs').get()).toMatchObject({listed:1,expires_at:'2026-11-18T00:00:00.000Z'});
});
it('does not revoke a newer paid period when an older invoice is refunded',async()=>{
 await recordPaidInvoice(state.db,invoice(),'paid',now);await checkout();const later=new Date('2026-10-20');await recordPaidInvoice(state.db,invoice('in_next','2026-10-19','2026-11-18'),'renew',later);
 await reversePayment(state.db,'pi_in_first','refund-old',later);expect(state.sql.prepare('SELECT listed FROM jobs').get().listed).toBe(1);
 await reversePayment(state.db,'pi_in_next','refund-current',later);expect(state.sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);
 await recordPaidInvoice(state.db,invoice('in_next','2026-10-19','2026-11-18'),'retry',later);expect(state.sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);
});
it('expires unpaid periods, activates future periods only when due, and respects manual closure',async()=>{
 await recordPaidInvoice(state.db,invoice(),'paid',now);await checkout();await recordPaidInvoice(state.db,invoice('in_next','2026-10-20','2026-11-19'),'renew',now);
 await reconcileListingPeriods(state.db,new Date('2026-10-19T12:00:00Z'));expect(state.sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);
 await reconcileListingPeriods(state.db,new Date('2026-10-21'));expect(state.sql.prepare('SELECT listed FROM jobs').get().listed).toBe(1);
 state.sql.exec("UPDATE employer_listings SET closed_at='2026-10-21'");await reconcileListingPeriods(state.db,new Date('2026-10-22'));expect(state.sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);
});
it('rejects wrong amount, customer, subscription and ambiguous periods without granting access',async()=>{
 await checkout();for(const patch of [{subtotal:1},{customer:'someone_else'},{subscription:'other_sub'},{lines:{data:[],has_more:false}}])await expect(recordPaidInvoice(state.db,{...invoice(),...patch},'evt',now)).rejects.toThrow();
 expect(state.sql.prepare('SELECT COUNT(*) n FROM listing_invoice_periods').get().n).toBe(0);
});
it('resolves both the legacy and newer Stripe invoice payment association',async()=>{
 const modern={...invoice(),orderId:undefined,subscription:undefined,payment_intent:undefined,parent:{subscription_details:{subscription:'sub',metadata:{orderId:'order'}}}};
 const fetcher=async()=>Response.json({data:[{payment:{type:'payment_intent',payment_intent:'pi_new'}}],has_more:false});
 expect(await resolveInvoice('test-key',modern,fetcher)).toMatchObject({orderId:'order',subscription:'sub',payment_intent:'pi_new'});
 expect(await resolveInvoice('test-key',{...invoice(),subscription_details:{metadata:{orderId:'order'}}},async()=>{throw Error('must not fetch')})).toMatchObject({payment_intent:'pi_in_first'});
});
