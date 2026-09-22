import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {pricing} from '@gaming/shared';
import {testDatabase} from '../test-db';
import {approveCompanyClaim, canManageCompany, companyAccountActive, companyIsClaimed, companyPurchaseStatements, createCompanyClaimOrder, fulfillCompanyClaim, reverseCompanyPurchase} from './company-claims';

let state: ReturnType<typeof testDatabase>;
const tenant = 'tenant:gaming', now = new Date('2026-09-22T12:00:00Z');
beforeEach(() => {
  state = testDatabase();
  state.sql.exec(`INSERT INTO users(id,tenant_id,email,email_verified,name,created_at) VALUES
    ('buyer','tenant:gaming','buyer@example.com',1,'Buyer','2026-01-01'),('admin','tenant:gaming','admin@example.net',1,'Admin','2026-01-01'),
    ('other','tenant:gaming','other@example.net',1,'Other','2026-01-01'),('unverified','tenant:gaming','new@example.net',0,'New','2026-01-01');
    INSERT INTO companies(id,tenant_id,name,name_norm,domain,created_at) VALUES('example','tenant:gaming','Example','example','example.com','2026-01-01');`);
});
afterEach(() => state.sql.close());
async function order(id = 'one', userId = 'buyer') {
  const result = await createCompanyClaimOrder(state.db,{id,tenantId:tenant,userId,companyId:'example',companyUrl:'https://example.com'},now);
  state.sql.prepare('UPDATE company_claim_orders SET stripe_session_id=? WHERE id=?').run(`cs_${id}`,id); return result;
}
const paid = (id = 'one') => ({id:`cs_${id}`,metadata:{claimOrderId:id},payment_status:'paid',payment_intent:`pi_${id}`,currency:'usd',amount_subtotal:pricing.companyClaim,amount_total:pricing.companyClaim});
const approve = (id = 'one') => approveCompanyClaim(state.db,{claimId:`claim:purchase:claim:${id}`,tenantId:tenant,adminId:'admin',reason:'Ownership verified through corporate records and an authorized contact.'},now);

describe('paid company account and verified claim', () => {
  it('creates a pending checkout without creating an employer account or ownership', async () => {
    const pending = await order(); expect(pending.total_cents).toBe(pricing.companyClaim);
    expect(await companyAccountActive(state.db,tenant,'buyer')).toBe(false);
    expect(state.sql.prepare('SELECT COUNT(*) n FROM employer_accounts').get().n).toBe(0);
    expect(await companyIsClaimed(state.db,tenant,'example')).toBe(false);
    expect(await fulfillCompanyClaim(state.db,{...paid(),payment_status:'unpaid'},'unpaid',now)).toBe(false);
  });
  it('activates the account exactly once after payment, with no included job and ownership still pending', async () => {
    await order(); expect(await fulfillCompanyClaim(state.db,paid(),'paid',now)).toBe(true);
    expect(await fulfillCompanyClaim(state.db,paid(),'duplicate',now)).toBe(false);
    expect(await companyAccountActive(state.db,tenant,'buyer')).toBe(true);
    expect(state.sql.prepare('SELECT COUNT(*) n FROM employer_accounts').get().n).toBe(1);
    expect(state.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n).toBe(0);
    expect(state.sql.prepare('SELECT COUNT(*) n FROM bundle_credits').get().n).toBe(0);
    expect(await companyIsClaimed(state.db,tenant,'example')).toBe(false);
    expect(await canManageCompany(state.db,tenant,'buyer','example')).toBe(false);
    await approve(); expect(await companyIsClaimed(state.db,tenant,'example')).toBe(true);
    expect(await canManageCompany(state.db,tenant,'buyer','example')).toBe(true);
    expect(await canManageCompany(state.db,tenant,'other','example')).toBe(false);
  });
  it('requires verified email, tenant ownership and a matching website; reused IDs cannot change the buyer', async () => {
    await expect(order('a','unverified')).rejects.toThrow('Verify');
    await expect(createCompanyClaimOrder(state.db,{id:'b',tenantId:tenant,userId:'buyer',companyId:'example',companyUrl:'https://attacker.com'})).rejects.toThrow('website');
    await expect(createCompanyClaimOrder(state.db,{id:'c',tenantId:'other',userId:'buyer',companyId:'example',companyUrl:'https://example.com'})).rejects.toThrow();
    await order(); await expect(order('one','other')).rejects.toThrow('Submission ID');
  });
  it('rejects altered amounts, currency and unbound sessions, and honors a verified coupon', async () => {
    await order();
    for (const patch of [{amount_total:1},{currency:'eur'},{id:'cs_wrong'},{subscription:'sub_wrong'},{payment_intent:undefined}]) await expect(fulfillCompanyClaim(state.db,{...paid(),...patch},'bad',now)).rejects.toThrow();
    const discount = Math.floor(pricing.companyClaim / 10);
    expect(await fulfillCompanyClaim(state.db,{...paid(),amount_total:pricing.companyClaim-discount,total_details:{amount_discount:discount}},'coupon',now)).toBe(true);
  });
  it('cannot approve two owners even if both paid before verification', async () => {
    await order(); await fulfillCompanyClaim(state.db,paid(),'paid1',now);
    await state.db.batch(companyPurchaseStatements(state.db,{id:'other-purchase',tenantId:tenant,userId:'other',companyId:'example',companyUrl:'https://example.com',kind:'annual_plan',sourceId:'plan',paymentIntent:'pi_plan'},now,'1',[]));
    await approve(); await expect(approveCompanyClaim(state.db,{claimId:'claim:other-purchase',tenantId:tenant,adminId:'admin',reason:'Ownership checked independently.'},now)).rejects.toThrow('another owner');
    await expect(order('three','other')).rejects.toThrow('already claimed');
  });
  it('resumes the same buyer checkout and prevents simultaneous standalone claim purchases',async()=>{
    const first=await order();
    const retry=await createCompanyClaimOrder(state.db,{id:'new-submission',tenantId:tenant,userId:'buyer',companyId:'example',companyUrl:'https://example.com'},now);
    expect(retry.id).toBe(first.id);
    await expect(order('competing','other')).rejects.toThrow('already in progress');
    await fulfillCompanyClaim(state.db,paid(),'paid',now);
    await expect(order('competing','other')).rejects.toThrow('already in progress');
  });
  it.each(['before','after'] as const)('reverses access when a refund arrives %s fulfillment', async timing => {
    await order();
    if (timing === 'before') await reverseCompanyPurchase(state.db,'pi_one','refund',now);
    await fulfillCompanyClaim(state.db,paid(),'paid',now);
    if (timing === 'after') {await approve(); await reverseCompanyPurchase(state.db,'pi_one','refund',now);}
    expect(await companyAccountActive(state.db,tenant,'buyer')).toBe(false);
    expect(await companyIsClaimed(state.db,tenant,'example')).toBe(false);
    await expect(approve()).rejects.toThrow();
  });
  it.each(['job','annual_plan'] as const)('includes a claim with a validated %s purchase and does not sell it again', async kind => {
    await state.db.batch(companyPurchaseStatements(state.db,{id:`ent:${kind}`,tenantId:tenant,userId:'buyer',companyId:'example',companyUrl:'https://example.com',kind,sourceId:'purchase',paymentIntent:'pi_purchase'},now,'1',[]));
    expect(await companyAccountActive(state.db,tenant,'buyer')).toBe(true);
    expect(state.sql.prepare('SELECT COUNT(*) n FROM company_claims').get().n).toBe(1);
    await expect(order()).rejects.toThrow('already includes');
  });
  it('rolls back every activation write when fulfillment fails halfway', async () => {
    await order();
    state.sql.exec("CREATE TRIGGER reject_claim BEFORE INSERT ON company_claims BEGIN SELECT RAISE(ABORT,'simulated database failure'); END;");
    await expect(fulfillCompanyClaim(state.db,paid(),'failed',now)).rejects.toThrow('simulated');
    expect(await companyAccountActive(state.db,tenant,'buyer')).toBe(false);
    expect(state.sql.prepare('SELECT status FROM company_claim_orders').get().status).toBe('pending');
  });
});
