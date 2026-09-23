import {pricing} from '@gaming/shared';
// Owners retain access to their purchases; team access follows the current paid seat allowance.
export const COMPANY_MEMBER_ACCESS_SQL=`EXISTS(SELECT 1 FROM company_members m WHERE m.company_id=j.company_id AND m.user_id=?
 AND EXISTS(SELECT 1 FROM company_claims k JOIN company_purchase_entitlements e ON e.id=k.entitlement_id WHERE k.company_id=m.company_id AND k.status='approved' AND e.status='active')
 AND (m.role='owner' OR EXISTS(SELECT 1 FROM company_plans p WHERE p.company_id=m.company_id AND p.status IN ('active','trialing') AND julianday(p.renews_at)>julianday('now')
 AND (SELECT COUNT(*) FROM company_members m2 WHERE m2.company_id=m.company_id AND (m2.role='owner' OR m2.created_at<m.created_at OR (m2.created_at=m.created_at AND m2.user_id<=m.user_id)))<=CASE p.tier WHEN 'starter' THEN ${pricing.plans.starter.seats} WHEN 'growth' THEN ${pricing.plans.growth.seats} WHEN 'scale' THEN ${pricing.plans.scale.seats} ELSE 1000000 END)))`;
export const JOB_ACCESS_SQL=`(l.user_id=? OR ${COMPANY_MEMBER_ACCESS_SQL})`;
