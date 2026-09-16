import type {Database,Statement} from '../platform';
import type {PaidSession} from './employer-orders';
export const SPONSOR_PRICES={1:499900,2:399900,3:299900,4:199900} as const;
export type SponsorInput={slot:1|2|3|4;title:string;subtitle:string;url:string;color:string};
export type MarketOrder={id:string;user_id:string|null;kind:'sponsor'|'recruiter';payload_json:string;total_cents:number;status:string;stripe_session_id:string|null;expires_at:string|null};
export function parseSponsor(raw:unknown):SponsorInput{
 const r=raw as Partial<SponsorInput>|null;
 if(!r||!Number.isInteger(r.slot)||!Object.hasOwn(SPONSOR_PRICES,r.slot!))throw new Error('Choose an advertising slot');
 if(typeof r.title!=='string'||r.title.trim().length<3||r.title.length>120||typeof r.subtitle!=='string'||r.subtitle.length>240||typeof r.color!=='string'||!/^#[0-9a-f]{6}$/i.test(r.color))throw new Error('Invalid banner details');
 let url:URL;try{url=new URL(r.url!);}catch{throw new Error('Invalid banner link');}
 if(url.protocol!=='https:'||url.username||url.password)throw new Error('Use a secure banner link');
 return {slot:r.slot!,title:r.title.trim(),subtitle:r.subtitle.trim(),url:url.href,color:r.color};
}
export async function marketOrder(db:Database,id:string){return db.prepare('SELECT * FROM marketplace_orders WHERE id=?').bind(id).first<MarketOrder>();}
export async function createMarketOrder(db:Database,input:{id:string;userId:string;kind:'sponsor'|'recruiter';sponsor?:SponsorInput}){
 let price:number,payload:string;
 if(input.kind==='sponsor'){if(!input.sponsor)throw new Error('Missing banner');price=SPONSOR_PRICES[input.sponsor.slot];payload=JSON.stringify(input.sponsor);}
 else {const verified=await db.prepare("SELECT 1 FROM recruiter_accounts WHERE user_id=? AND status='verified'").bind(input.userId).first();if(!verified)throw new Error('Your recruiter account needs verification before purchase');price=Number(await db.prepare("SELECT value FROM marketplace_settings WHERE key='recruiter_price_cents'").bind().first<string>('value'));if(!Number.isSafeInteger(price)||price<100)throw new Error('Recruiter purchases are not configured yet');payload='{}';}
 await db.prepare(`INSERT OR IGNORE INTO marketplace_orders(id,user_id,kind,payload_json,total_cents,created_at) VALUES(?,?,?,?,?,?)`).bind(input.id,input.userId,input.kind,payload,price,new Date().toISOString()).run();
 const order=await marketOrder(db,input.id);
 if(!order||order.user_id!==input.userId||order.kind!==input.kind||order.payload_json!==payload)throw new Error('Submission ID already used');
 if(order.status!=='pending')throw new Error('Order already processed');
 if(input.sponsor){await db.prepare('UPDATE sponsor_slots SET order_id=? WHERE slot=? AND (order_id IS NULL OR order_id=?)').bind(order.id,input.sponsor.slot,order.id).run();const reserved=await db.prepare('SELECT order_id FROM sponsor_slots WHERE slot=?').bind(input.sponsor.slot).first<string>('order_id');if(reserved!==order.id)throw new Error('This slot is already reserved. Choose another slot');}
 return order;
}
export async function fulfillMarketOrder(db:Database,session:PaidSession&{payment_intent?:string},eventId:string,now=new Date()){
 if(!['paid','no_payment_required'].includes(session.payment_status))return false;
 const id=(session.metadata as {purchaseId?:string})?.purchaseId;
 const order=await marketOrder(db,id||'');if(!order||order.status!=='pending')return false;
 if(order.stripe_session_id&&order.stripe_session_id!==session.id)throw new Error('Checkout session mismatch');
 if(session.currency!=='usd'||session.amount_subtotal!==order.total_cents||session.amount_total!==order.total_cents)throw new Error('Checkout amount mismatch');
 if(order.kind==='sponsor'){const slot=await db.prepare('SELECT slot FROM sponsor_slots WHERE order_id=?').bind(order.id).first();if(!slot)throw new Error('Advertising reservation missing');}
 const expiry=new Date(now.getTime()+30*86400000).toISOString();
 await db.batch([
 db.prepare(`UPDATE marketplace_orders SET status='paid',paid_at=?,expires_at=?,stripe_session_id=?,stripe_customer_id=?,stripe_payment_intent_id=? WHERE id=? AND status='pending'`).bind(now.toISOString(),expiry,session.id,session.customer??null,session.payment_intent??null,order.id),
 db.prepare("INSERT OR IGNORE INTO marketplace_events(id,order_id,type,created_at) VALUES(?,?,'checkout.paid',?)").bind(eventId,order.id,now.toISOString())]);return true;
}
export async function expireMarketCheckout(db:Database,sessionId:string,eventId:string){
 const order=await db.prepare("SELECT * FROM marketplace_orders WHERE stripe_session_id=? AND status='pending'").bind(sessionId).first<MarketOrder>();if(!order)return;
 await db.batch([db.prepare("UPDATE marketplace_orders SET status='expired' WHERE id=? AND status='pending'").bind(order.id),db.prepare("UPDATE sponsor_slots SET order_id=NULL WHERE order_id=? AND EXISTS(SELECT 1 FROM marketplace_orders WHERE id=? AND status='expired')").bind(order.id,order.id),db.prepare("INSERT OR IGNORE INTO marketplace_events(id,order_id,type,created_at) VALUES(?,?,'checkout.expired',?)").bind(eventId,order.id,new Date().toISOString())]);
}
export async function hasRecruiterAccess(db:Database,userId:string,now=new Date()){
 return !!await db.prepare(`SELECT 1 FROM recruiter_accounts r WHERE r.user_id=? AND r.status='verified' AND EXISTS(SELECT 1 FROM marketplace_orders o WHERE o.user_id=r.user_id AND o.kind='recruiter' AND o.status='paid' AND o.expires_at>?)`).bind(userId,now.toISOString()).first();
}
