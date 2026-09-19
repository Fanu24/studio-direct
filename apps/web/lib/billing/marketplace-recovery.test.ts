import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {testDatabase} from '../test-db';
import {recoverMarketCheckouts} from './marketplace-recovery';
let state:ReturnType<typeof testDatabase>;
const now=new Date('2026-09-19T12:00:00Z');
const checkout={id:'cs_test',metadata:{purchaseId:'order'},status:'open',payment_status:'unpaid',currency:'usd',amount_subtotal:499900,amount_total:499900,payment_intent:'pi_test'};
beforeEach(()=>{
 state=testDatabase();state.sql.exec(`INSERT INTO users(id,tenant_id,email,created_at) VALUES('qa','tenant:gaming','qa@example.test','2026-09-19');
 INSERT INTO marketplace_orders(id,user_id,kind,payload_json,total_cents,created_at) VALUES('order','qa','sponsor','{}',499900,'2026-09-19T11:00:00.000Z');
 UPDATE sponsor_slots SET order_id='order' WHERE slot=1;`);
});
afterEach(()=>state.sql.close());
const slot=()=>state.sql.prepare('SELECT order_id FROM sponsor_slots WHERE slot=1').get().order_id;
it('releases an orphan only after a complete empty Stripe lookup',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({data:[],has_more:false}));
 expect(await recoverMarketCheckouts(state.db,'test-key',fetcher,now)).toEqual({recovered:1,failed:0});
 expect(slot()).toBeNull();expect(state.sql.prepare('SELECT status FROM marketplace_orders').get().status).toBe('expired');
});
it('keeps a hold when Stripe times out, fails, or the bounded lookup is incomplete',async()=>{
 for(const fetcher of [vi.fn().mockRejectedValue(Error('network')),vi.fn().mockResolvedValue(new Response('',{status:503})),vi.fn().mockImplementation(()=>Response.json({data:[{id:'cs_other'}],has_more:true}))]){
  state.sql.exec("UPDATE marketplace_settings SET value='1970-01-01' WHERE key='checkout_recovery_at'");
  expect((await recoverMarketCheckouts(state.db,'test-key',fetcher,now)).failed).toBe(1);expect(slot()).toBe('order');
 }
});
it('restores a lost open session id without selling the occupied slot',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({data:[checkout],has_more:false}));
 await recoverMarketCheckouts(state.db,'test-key',fetcher,now);
 expect(state.sql.prepare('SELECT stripe_session_id FROM marketplace_orders').get().stripe_session_id).toBe('cs_test');expect(slot()).toBe('order');
});
it('follows session pagination and activates a completed payment whose webhook was lost',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({data:[{id:'cs_other'}],has_more:true}))
  .mockResolvedValueOnce(Response.json({data:[{...checkout,status:'complete',payment_status:'paid'}],has_more:false}))
  .mockResolvedValueOnce(Response.json({status:'succeeded',latest_charge:{refunded:false}}));
 expect((await recoverMarketCheckouts(state.db,'test-key',fetcher,now)).recovered).toBe(1);
 expect(fetcher.mock.calls[1][0]).toContain('starting_after=cs_other');
 expect(state.sql.prepare('SELECT status FROM marketplace_orders').get().status).toBe('paid');expect(slot()).toBe('order');
});
it('releases a known session only when Stripe confirms it expired',async()=>{
 state.sql.exec("UPDATE marketplace_orders SET stripe_session_id='cs_test'");
 const fetcher=vi.fn().mockResolvedValue(Response.json({...checkout,status:'expired'}));
 await recoverMarketCheckouts(state.db,'test-key',fetcher,now);expect(slot()).toBeNull();
});
it('refuses a session associated with another order',async()=>{
 state.sql.exec("UPDATE marketplace_orders SET stripe_session_id='cs_test'");
 const fetcher=vi.fn().mockResolvedValue(Response.json({...checkout,status:'expired',metadata:{purchaseId:'someone-else'}}));
 expect((await recoverMarketCheckouts(state.db,'test-key',fetcher,now)).failed).toBe(1);expect(slot()).toBe('order');
});
it('does not reconcile an attempt that may still be creating its Stripe session',async()=>{
 state.sql.exec("UPDATE marketplace_orders SET created_at='2026-09-19T11:55:00.000Z'");
 const fetcher=vi.fn();await recoverMarketCheckouts(state.db,'test-key',fetcher,now);expect(fetcher).not.toHaveBeenCalled();expect(slot()).toBe('order');
});
it('never activates an already refunded checkout when both webhook deliveries were missed',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({data:[{...checkout,status:'complete',payment_status:'paid'}],has_more:false}))
  .mockResolvedValueOnce(Response.json({status:'succeeded',latest_charge:{refunded:true}}));
 await recoverMarketCheckouts(state.db,'test-key',fetcher,now);
 expect(state.sql.prepare('SELECT status FROM marketplace_orders').get().status).toBe('refunded');expect(slot()).toBeNull();
});
it('limits reconciliation across repeated public inventory requests',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({data:[checkout],has_more:false}));
 await recoverMarketCheckouts(state.db,'test-key',fetcher,now);await recoverMarketCheckouts(state.db,'test-key',fetcher,now);
 expect(fetcher).toHaveBeenCalledTimes(1);
});
