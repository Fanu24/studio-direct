import {pricing, publicHttpsUrl} from '@gaming/shared';
import {COMPANY_MEMBER_ACCESS_SQL} from './job-access';
import type {Database, Statement} from '../platform';
import type {PaidSession} from '../billing/employer-orders';

export type CompanyClaimOrder = {id:string;tenant_id:string;user_id:string|null;company_id:string;company_url:string;total_cents:number;currency:string;status:string;stripe_session_id:string|null;stripe_payment_intent_id:string|null};
export async function claimOrderById(db: Database, id: string) {
  return db.prepare('SELECT * FROM company_claim_orders WHERE id=?').bind(id).first<CompanyClaimOrder>();
}
export async function companyAccountActive(db: Database, tenantId: string, userId: string) {
  if(await db.prepare(`SELECT j.company_id FROM company_members j WHERE j.user_id=? AND ${COMPANY_MEMBER_ACCESS_SQL}`).bind(userId,userId).first())return true;
  return !!await db.prepare(`SELECT id FROM company_purchase_entitlements WHERE tenant_id=? AND user_id=? AND status='active'
    UNION ALL SELECT id FROM employer_orders WHERE tenant_id=? AND user_id=? AND status='paid' AND offer_version=1 LIMIT 1`).bind(tenantId,userId,tenantId,userId).first();
}
export async function companyIsClaimed(db: Database, tenantId: string, companyId: string) {
  return !!await db.prepare(`SELECT c.id FROM company_claims c JOIN company_purchase_entitlements e ON e.id=c.entitlement_id
    WHERE c.tenant_id=? AND c.company_id=? AND c.status='approved' AND e.status='active' AND c.user_id IS NOT NULL LIMIT 1`).bind(tenantId,companyId).first();
}
export async function canManageCompany(db: Database, tenantId: string, userId: string, companyId: string) {
  return !!await db.prepare(`SELECT c.id FROM company_claims c JOIN company_purchase_entitlements e ON e.id=c.entitlement_id
    WHERE c.tenant_id=? AND c.company_id=? AND c.user_id=? AND c.status='approved' AND e.status='active' LIMIT 1`).bind(tenantId,companyId,userId).first();
}

export async function createCompanyClaimOrder(db: Database, input: {id:string;tenantId:string;userId:string;companyId:string;companyUrl:string}, now = new Date()) {
  const url = publicHttpsUrl(input.companyUrl);
  if (!url) throw new Error('Enter the public https:// company website.');
  const user = await db.prepare('SELECT email_verified FROM users WHERE id=? AND tenant_id=?').bind(input.userId,input.tenantId).first<{email_verified:number}>();
  if (!user?.email_verified) throw new Error('Verify your email before claiming a company.');
  const company = await db.prepare('SELECT domain FROM companies WHERE id=? AND tenant_id=? AND listed=1').bind(input.companyId,input.tenantId).first<{domain:string|null}>();
  if (!company) throw new Error('Company not found.');
  if (!company.domain || company.domain.toLowerCase().replace(/^www\./,'') !== new URL(url).hostname.replace(/^www\./,'')) throw new Error('The website must match the company page. Contact support to correct it.');
  const previous = await claimOrderById(db,input.id);
  if (previous) {
    if (previous.tenant_id !== input.tenantId || previous.user_id !== input.userId || previous.company_id !== input.companyId || previous.company_url !== url) throw new Error('Submission ID already used; start a new claim.');
    return previous;
  }
  if (await companyIsClaimed(db,input.tenantId,input.companyId)) throw new Error('This company is already claimed. Ask its owner for access.');
  const included = await db.prepare(`SELECT id FROM company_purchase_entitlements WHERE tenant_id=? AND user_id=? AND company_id=? AND status='active' LIMIT 1`).bind(input.tenantId,input.userId,input.companyId).first();
  if (included) throw new Error('Your purchase already includes this company claim. Continue in your company dashboard.');
  await db.prepare(`INSERT OR IGNORE INTO company_claim_orders(id,tenant_id,user_id,company_id,company_url,total_cents,created_at)
    SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM company_claims c JOIN company_purchase_entitlements e ON e.id=c.entitlement_id
      WHERE c.company_id=? AND c.status IN ('pending','approved') AND e.status='active')`)
    .bind(input.id,input.tenantId,input.userId,input.companyId,url,pricing.companyClaim,now.toISOString(),input.companyId).run();
  const order = await claimOrderById(db,input.id) ?? await db.prepare("SELECT * FROM company_claim_orders WHERE company_id=? AND status='pending'").bind(input.companyId).first<CompanyClaimOrder>();
  if (!order || order.user_id !== input.userId) throw new Error('A company claim is already in progress. Contact support if you represent this company.');
  if (order.tenant_id !== input.tenantId || order.company_id !== input.companyId || order.company_url !== url) throw new Error('Submission ID already used; start a new claim.');
  return order;
}

/** Called by validated purchase fulfillment inside the same transaction; selecting a company grants nothing. */
export function companyPurchaseStatements(db: Database, input: {id:string;tenantId:string;userId:string;companyId:string;companyUrl:string;kind:'job'|'annual_plan'|'claim';sourceId:string;paymentIntent:string|null}, now: Date, guard: string, values: unknown[]): Statement[] {
  const at = now.toISOString();
  return [
    db.prepare(`INSERT OR IGNORE INTO company_purchase_entitlements(id,tenant_id,user_id,company_id,kind,source_id,stripe_payment_intent_id,created_at)
      SELECT ?,?,?,?,?,?,?,? WHERE ${guard}`).bind(input.id,input.tenantId,input.userId,input.companyId,input.kind,input.sourceId,input.paymentIntent,at,...values),
    db.prepare(`INSERT OR IGNORE INTO company_claims(id,tenant_id,user_id,company_id,entitlement_id,created_at)
      SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM company_purchase_entitlements WHERE id=? AND status='active')
      AND NOT EXISTS(SELECT 1 FROM company_claims WHERE company_id=? AND user_id=? AND status IN ('approved','pending'))`)
      .bind(`claim:${input.id}`,input.tenantId,input.userId,input.companyId,input.id,at,input.id,input.companyId,input.userId),
    db.prepare(`INSERT OR IGNORE INTO employer_accounts(user_id,company_name,company_url,contact_name,created_at,updated_at)
      SELECT u.id,c.name,?,u.name,?,? FROM users u JOIN companies c ON c.id=? AND c.tenant_id=u.tenant_id
      WHERE u.id=? AND EXISTS(SELECT 1 FROM company_purchase_entitlements WHERE id=? AND status='active')`)
      .bind(input.companyUrl,at,at,input.companyId,input.userId,input.id),
  ];
}

export async function fulfillCompanyClaim(db: Database, session: PaidSession, eventId: string, now = new Date()) {
  if (!['paid','no_payment_required'].includes(session.payment_status)) return false;
  if(session.livemode===true)throw new Error('Expected a test-mode checkout');
  const order = await claimOrderById(db,session.metadata?.claimOrderId ?? '');
  if (!order || order.status !== 'pending' || !order.user_id) return false;
  if (!order.stripe_session_id || order.stripe_session_id !== session.id) throw new Error('Claim checkout session mismatch.');
  const discount = session.total_details?.amount_discount ?? 0, tax = session.total_details?.amount_tax ?? 0;
  if (session.subscription || session.currency !== order.currency || session.amount_subtotal !== order.total_cents
    || !Number.isSafeInteger(discount) || discount < 0 || discount > order.total_cents || !Number.isSafeInteger(tax) || tax < 0
    || session.amount_total !== order.total_cents - discount + tax) throw new Error('Claim checkout amount mismatch.');
  const intent = session.payment_intent ?? null;
  if (session.amount_total > 0 && !intent) throw new Error('Claim payment reference missing.');
  const guard = `EXISTS(SELECT 1 FROM company_claim_orders WHERE id=? AND status='pending' AND user_id IS NOT NULL)
    AND NOT EXISTS(SELECT 1 FROM payment_reversals WHERE payment_intent_id=?)`;
  await db.batch([
    ...companyPurchaseStatements(db,{id:`purchase:claim:${order.id}`,tenantId:order.tenant_id,userId:order.user_id,companyId:order.company_id,companyUrl:order.company_url,kind:'claim',sourceId:order.id,paymentIntent:intent},now,guard,[order.id,intent]),
    db.prepare(`UPDATE company_claim_orders SET status=CASE WHEN EXISTS(SELECT 1 FROM payment_reversals WHERE payment_intent_id=?) THEN 'refunded' ELSE 'paid' END,
      stripe_payment_intent_id=?,paid_at=? WHERE id=? AND status='pending'`).bind(intent,intent,now.toISOString(),order.id),
    db.prepare(`INSERT OR IGNORE INTO product_billing_events(id,source_id,type,processed_at) VALUES(?,?,'claim.paid',?)`).bind(eventId,order.id,now.toISOString()),
  ]);
  return (await claimOrderById(db,order.id))?.status === 'paid';
}

/** Admin authorization is checked by the caller. This transition never treats payment as ownership proof. */
export async function approveCompanyClaim(db: Database, input: {claimId:string;tenantId:string;adminId:string;reason:string}, now = new Date()) {
  if (input.reason.trim().length < 10 || input.reason.length > 2000) throw new Error('Record how company ownership was verified.');
  const result = await db.prepare(`UPDATE company_claims SET status='approved',verification_method='admin',verified_by=?,verified_at=?,reason=?
    WHERE id=? AND tenant_id=? AND status='pending' AND user_id IS NOT NULL
    AND EXISTS(SELECT 1 FROM company_purchase_entitlements e WHERE e.id=company_claims.entitlement_id AND e.status='active')
    AND NOT EXISTS(SELECT 1 FROM company_claims other WHERE other.company_id=company_claims.company_id AND other.status='approved')`)
    .bind(input.adminId,now.toISOString(),input.reason.trim(),input.claimId,input.tenantId).run();
  if (result.meta?.changes !== 1) throw new Error('Claim unavailable, already processed or another owner has been verified.');
  await db.batch([
    db.prepare('DELETE FROM company_members WHERE company_id=(SELECT company_id FROM company_claims WHERE id=?)').bind(input.claimId),
    db.prepare("UPDATE company_team_invitations SET status='revoked' WHERE company_id=(SELECT company_id FROM company_claims WHERE id=?) AND status='pending'").bind(input.claimId),
  ]);
  await db.prepare("INSERT OR IGNORE INTO company_members(company_id,user_id,role,created_at) SELECT company_id,user_id,'owner',? FROM company_claims WHERE id=? AND status='approved'").bind(now.toISOString(),input.claimId).run();
}
export async function reverseCompanyPurchase(db: Database, paymentIntent: string, eventId: string, now = new Date()) {
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO payment_reversals(payment_intent_id,event_id,reversed_at) VALUES(?,?,?)').bind(paymentIntent,eventId,now.toISOString()),
    db.prepare(`UPDATE company_claim_orders SET status='refunded' WHERE stripe_payment_intent_id=?`).bind(paymentIntent),
    db.prepare(`UPDATE company_purchase_entitlements SET status='refunded',revoked_at=? WHERE stripe_payment_intent_id=?`).bind(now.toISOString(),paymentIntent),
    db.prepare(`UPDATE company_claims SET entitlement_id=(SELECT replacement.id FROM company_purchase_entitlements replacement
      WHERE replacement.company_id=company_claims.company_id AND replacement.user_id=company_claims.user_id AND replacement.status='active' ORDER BY replacement.created_at,replacement.id LIMIT 1)
      WHERE entitlement_id IN(SELECT id FROM company_purchase_entitlements WHERE stripe_payment_intent_id=?)
      AND EXISTS(SELECT 1 FROM company_purchase_entitlements replacement WHERE replacement.company_id=company_claims.company_id AND replacement.user_id=company_claims.user_id AND replacement.status='active')`).bind(paymentIntent),
    db.prepare(`UPDATE company_claims SET status='revoked' WHERE entitlement_id IN(SELECT id FROM company_purchase_entitlements WHERE stripe_payment_intent_id=?)`).bind(paymentIntent),
  ]);
}

/** Historical job purchases and redeemed bundle credits retain their included company claim. */
export function legacyCompanyClaimStatements(db:Database,orderId:string):Statement[] {
  return [
    db.prepare(`INSERT OR IGNORE INTO company_purchase_entitlements(id,tenant_id,user_id,company_id,kind,source_id,stripe_payment_intent_id,created_at)
      SELECT 'purchase:legacy-job:'||j.id,j.tenant_id,l.user_id,j.company_id,'job',j.id,o.stripe_payment_intent_id,COALESCE(o.paid_at,j.created_at)
      FROM employer_listings l JOIN jobs j ON j.id=l.job_id JOIN employer_orders o ON o.id=l.order_id
      WHERE o.id=? AND o.status='paid' AND o.offer_version=1 AND l.user_id IS NOT NULL AND l.user_id=o.user_id AND j.tenant_id=o.tenant_id
      AND NOT EXISTS(SELECT 1 FROM payment_reversals r WHERE r.payment_intent_id=o.stripe_payment_intent_id)`).bind(orderId),
    db.prepare(`INSERT OR IGNORE INTO company_claims(id,tenant_id,user_id,company_id,entitlement_id,created_at)
      SELECT 'claim:'||MIN(e.id),e.tenant_id,e.user_id,e.company_id,MIN(e.id),MIN(e.created_at)
      FROM company_purchase_entitlements e WHERE e.status='active' AND e.user_id IS NOT NULL
      AND e.kind='job' AND e.source_id IN(SELECT job_id FROM employer_listings WHERE order_id=?)
      AND NOT EXISTS(SELECT 1 FROM company_claims c WHERE c.company_id=e.company_id AND c.user_id=e.user_id AND c.status IN ('approved','pending'))
      GROUP BY e.tenant_id,e.user_id,e.company_id`).bind(orderId),
  ];
}
