import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {testDatabase} from '../lib/test-db';
import {createEmployerOrder,fulfillEmployerOrder} from '../lib/billing/employer-orders';
import {DEFAULT_SELECTION} from '../lib/billing/listing-catalog';
import {parseListing} from '../lib/billing/listing-input';
import {resolveInvoice,recordPaidInvoice,recordSubscriptionState} from '../lib/billing/invoices';
import {reversePayment} from '../lib/billing/reversals';
import {reconcileListingPeriods} from '@gaming/shared';

// Explicit opt-in only. Creates an isolated Stripe test clock and disposable test
// customer; never reads or mutates the application's local or production database.
it.skipIf(process.env.STRIPE_SANDBOX_QA!=='true')('processes real Stripe renewal invoices, refunds and cancellation',async()=>{
 const secret=readFileSync('.dev.vars','utf8').match(/^STRIPE_SECRET_KEY=(.+)$/m)?.[1]?.trim();
 if(!secret?.startsWith('sk_test_'))throw Error('A Stripe sandbox key is required');
 const request=async(path:string,body?:Record<string,string>,method=body?'POST':'GET')=>{
  const response=await fetch('https://api.stripe.com/v1/'+path,{method,headers:{Authorization:'Bearer '+secret,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:body?new URLSearchParams(body):undefined,signal:AbortSignal.timeout(20000)});
  const result=await response.json();if(!response.ok)throw Error('Stripe sandbox: '+(result.error?.message||response.status));return result;
 };
 const state=testDatabase(),orderId=crypto.randomUUID(),start=Math.floor(Date.now()/1000);
 let clockId:string|undefined,productId:string|undefined,priceId:string|undefined;
 try{
  state.sql.exec("INSERT INTO users(id,tenant_id,email,created_at) VALUES('sandbox','tenant:gaming','recurring-qa@example.test','2026-09-19')");
  const order=await createEmployerOrder(state.db,{id:orderId,tenantId:'tenant:gaming',userId:'sandbox',kind:'job',selection:DEFAULT_SELECTION,listing:parseListing({title:'Sandbox recurring verification',companyName:'Sandbox fixture',companyUrl:'https://example.com',location:'Worldwide',remote:'remote',applyMode:'internal',primarySkill:'solidity',descriptionHtml:'This is a disposable sandbox integration fixture, not a real vacancy. '.repeat(3)},'recurring-qa@example.test')});
  const clock=await request('test_helpers/test_clocks',{frozen_time:String(start),name:'Nodework recurring verification'});clockId=clock.id;
  const customer=await request('customers',{test_clock:clock.id,email:'recurring-qa@example.test',payment_method:'pm_card_visa','invoice_settings[default_payment_method]':'pm_card_visa'});
  const product=await request('products',{name:'[SANDBOX QA] Recurring listing'});productId=product.id;
  const price=await request('prices',{product:product.id,unit_amount:String(order.total_cents),currency:'usd','recurring[interval]':'day','recurring[interval_count]':'30'});priceId=price.id;
  const sub=await request('subscriptions',{customer:customer.id,'items[0][price]':price.id,'metadata[orderId]':order.id});
  const initial=await resolveInvoice(secret,await request('invoices/'+sub.latest_invoice));
  expect(initial.status).toBe('paid');
  await recordPaidInvoice(state.db,initial,'sandbox:first',new Date(start*1000));
  // Checkout fulfillment itself has a separate browser/webhook sandbox test.
  await fulfillEmployerOrder(state.db,{id:'cs_fixture_'+order.id,subscription:sub.id,customer:customer.id,metadata:{orderId:order.id},payment_status:'paid',currency:'usd',amount_subtotal:order.total_cents,amount_total:order.total_cents},'sandbox:checkout',new Date(start*1000));
  expect(state.sql.prepare('SELECT listed FROM jobs').get().listed).toBe(1);
  async function advance(at:number){await request('test_helpers/test_clocks/'+clock.id+'/advance',{frozen_time:String(at)});for(let attempt=0;attempt<30;attempt++){await new Promise(r=>setTimeout(r,2000));if((await request('test_helpers/test_clocks/'+clock.id)).status==='ready')return;}throw Error('Stripe test clock timed out');}
  // Advancing across billing, then the invoice finalization delay, produces an
  // actual second paid invoice rather than a fabricated webhook fixture.
  const next=start+30*86400+60;await advance(next);await advance(next+7200);
  const list=await request('invoices?subscription='+sub.id+'&status=paid');
  expect(list.data.length).toBeGreaterThanOrEqual(2);
  const renewal=await resolveInvoice(secret,list.data.find((i:any)=>i.id!==initial.id));
  const now=new Date((next+7200)*1000);
  await recordPaidInvoice(state.db,renewal,'sandbox:renewal',now);
  expect(state.sql.prepare('SELECT expires_at FROM jobs').get().expires_at).toBe(new Date(renewal.lines.data[0].period.end*1000).toISOString());
  await request('refunds',{payment_intent:initial.payment_intent});await reversePayment(state.db,initial.payment_intent,'sandbox:old-refund',now);
  expect(state.sql.prepare('SELECT listed FROM jobs').get().listed).toBe(1);
  const cancelled=await request('subscriptions/'+sub.id,{cancel_at_period_end:'true'});await recordSubscriptionState(state.db,cancelled,next+7200);
  expect(state.sql.prepare('SELECT renewal_status FROM employer_orders').get().renewal_status).toBe('cancelling');
  await reconcileListingPeriods(state.db,new Date((renewal.lines.data[0].period.end+1)*1000));
  expect(state.sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);
  await request('refunds',{payment_intent:renewal.payment_intent});await reversePayment(state.db,renewal.payment_intent,'sandbox:current-refund',now);
  expect(state.sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);
  console.log(JSON.stringify({sandbox:true,initialInvoice:initial.id,renewalInvoice:renewal.id,checks:'paid periods, renewal, old/current refunds, cancellation, expiry'}));
 }finally{
  if(clockId)await request('test_helpers/test_clocks/'+clockId,undefined,'DELETE');
  if(priceId)await request('prices/'+priceId,{active:'false'});
  if(productId)await request('products/'+productId,{active:'false'});
  state.sql.close();
 }
},240000);
