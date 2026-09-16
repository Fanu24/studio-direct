import {it,expect} from 'vitest';
import {testDatabase} from '../test-db';
import {prepareCommerceDeletion,reversePayment} from './reversals';
import {deleteAccount} from '../profile/delete-account';
it('revokes refunded sponsorship and releases inventory idempotently',async()=>{
 const {sql,db}=testDatabase();
 sql.exec(`INSERT INTO users(id,tenant_id,email,created_at) VALUES('u','tenant:gaming','u@example.test','2026-01-01');
 INSERT INTO marketplace_orders(id,user_id,kind,payload_json,total_cents,status,stripe_payment_intent_id,created_at) VALUES('m','u','sponsor','{}',199900,'paid','pi_1','2026-01-01');
 UPDATE sponsor_slots SET order_id='m' WHERE slot=4;`);
 await reversePayment(db,'pi_1','evt_1');await reversePayment(db,'pi_1','evt_1');
 expect(sql.prepare('SELECT status FROM marketplace_orders').get().status).toBe('refunded');
 expect(sql.prepare('SELECT order_id FROM sponsor_slots WHERE slot=4').get().order_id).toBeNull();
 expect(sql.prepare('SELECT COUNT(*) n FROM marketplace_events').get().n).toBe(1);sql.close();
});
it('deletes an account with commerce records while retaining anonymized order totals',async()=>{
 const {sql,db}=testDatabase();
 sql.exec(`INSERT INTO users(id,tenant_id,email,created_at) VALUES('u','tenant:gaming','u@example.test','2026-01-01');
 INSERT INTO employer_orders(id,tenant_id,user_id,kind,payload_json,selection_json,total_cents,status,created_at) VALUES('o','tenant:gaming','u','bundle','{"contactEmail":"u@example.test"}','{}',100,'paid','2026-01-01');
 INSERT INTO bundle_credits(id,order_id,slot,user_id,selection_json,expires_at) VALUES('c','o',0,'u','{}','2027-01-01');
 INSERT INTO support_requests(id,user_id,subject,message,created_at) VALUES('t','u','Question','Private message','2026-01-01');`);
 await prepareCommerceDeletion(db,'u');await deleteAccount({db,userId:'u',files:{delete:async()=>{}}});
 expect(sql.prepare('SELECT COUNT(*) n FROM users').get().n).toBe(0);
 expect(sql.prepare('SELECT user_id,payload_json,total_cents FROM employer_orders').get()).toMatchObject({user_id:null,payload_json:'{}',total_cents:100});
 expect(sql.prepare('SELECT COUNT(*) n FROM bundle_credits').get().n).toBe(0);
 expect(sql.prepare('PRAGMA foreign_key_check').all()).toEqual([]);sql.close();
});
it('retains the account when recurring billing cannot be cancelled',async()=>{
 const {sql,db}=testDatabase();sql.exec(`INSERT INTO users(id,tenant_id,email,created_at) VALUES('u','tenant:gaming','u@example.test','2026-01-01');INSERT INTO employer_orders(id,tenant_id,user_id,kind,payload_json,selection_json,total_cents,status,stripe_subscription_id,created_at) VALUES('o','tenant:gaming','u','job','{}','{}',100,'paid','sub_1','2026-01-01');`);
 await expect(prepareCommerceDeletion(db,'u')).rejects.toThrow('Billing must be connected');
 expect(sql.prepare('SELECT COUNT(*) n FROM users').get().n).toBe(1);sql.close();
});
