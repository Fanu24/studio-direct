/** Public readers select only these salary fields; private billing snapshots are never serialized. */
export const PUBLIC_SALARY_SQL = `
  CASE WHEN j.hide_salary=1 THEN 'Not disclosed' ELSE j.salary_text END AS salaryText,
  CASE WHEN j.hide_salary=1 THEN NULL ELSE j.salary_min END AS salaryMin,
  CASE WHEN j.hide_salary=1 THEN NULL ELSE j.salary_max END AS salaryMax,
  j.salary_currency AS salaryCurrency,j.salary_period AS salaryPeriod,j.hide_salary AS hideSalary,
  j.crypto_payment_available AS cryptoPaymentAvailable,j.commercial_origin AS commercialOrigin,
  CASE WHEN j.commercial_origin IN ('native','native_ats') THEN j.early_access_until ELSE NULL END AS earlyAccessUntil`;

export const PUBLIC_HIGHLIGHT_SQL = `CASE WHEN j.commercial_origin='aggregated' THEN 0
  WHEN EXISTS(SELECT 1 FROM native_listing_details n WHERE n.job_id=j.id) THEN CASE WHEN julianday(j.pinned_until)>julianday('now') THEN 1 ELSE 0 END
  ELSE j.highlight END AS highlight`;
export const PUBLIC_PIN_SQL = `CASE WHEN j.commercial_origin IN ('native','native_ats') AND julianday(COALESCE(j.pinned_until,j.featured_until))>julianday('now') THEN COALESCE(j.pinned_until,j.featured_until) ELSE NULL END AS featuredUntil`;

// Explicit whitelist: the private snapshot also holds email addresses and hidden salary values.
export const PUBLIC_REQUIREMENTS_SQL = `(SELECT json_object(
  'requiredSkills',json_extract(n.input_json,'$.requiredSkillIds'),
  'preferredSkills',json_extract(n.input_json,'$.preferredSkillIds'),
  'languages',json_extract(n.input_json,'$.languages'),
  'benefits',json_extract(n.input_json,'$.benefitSlugs'),
  'eligibility',json_extract(n.input_json,'$.eligibility'))
  FROM native_listing_details n WHERE n.job_id=j.id) AS requirementsJson`;

export {annualUsdSalarySql} from '@gaming/shared';
export const DEFAULT_JOB_ORDER_SQL = `ORDER BY
  CASE WHEN j.commercial_origin IN ('native','native_ats') AND julianday(COALESCE(j.pinned_until,j.featured_until))>julianday('now') THEN 0 ELSE 1 END,
  CASE WHEN j.commercial_origin IN ('native','native_ats') AND julianday(COALESCE(j.pinned_until,j.featured_until))>julianday('now') THEN julianday(COALESCE(j.pinned_until,j.featured_until)) END DESC,
  MAX(COALESCE(julianday(j.published_at),julianday(j.posted_at),julianday(j.created_at),0),COALESCE(julianday(j.bumped_at),0)) DESC,
  j.id ASC`;
