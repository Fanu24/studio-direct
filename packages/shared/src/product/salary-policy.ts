import {averageSalary} from '../salary.ts';

export const MIN_SALARY_SAMPLE = 5;

/** Internal calculation only. Never project these expressions as an individual hidden salary. */
export function annualUsdSalarySql(bound:'min'|'max') {
  return `(j.salary_${bound} * CASE COALESCE(j.salary_period,'yearly') WHEN 'yearly' THEN 1 WHEN 'monthly' THEN 12 WHEN 'hourly' THEN 2080 END *
    CASE WHEN j.salary_currency IS NULL OR j.salary_currency='USD' THEN 1 ELSE (SELECT rate_to_usd FROM fx_rates WHERE currency=j.salary_currency AND rate_to_usd>0 AND julianday(updated_at)>=julianday('now','-7 days') AND julianday(updated_at)<=julianday('now','+1 hour')) END)`;
}

export const RELIABLE_SALARY_SQL = `(${annualUsdSalarySql('min')}>0 AND ${annualUsdSalarySql('max')}>=${annualUsdSalarySql('min')})`;

/** Owner policy: market salary statistics use external scraped jobs only, never our paid posts. */
export const SCRAPED_JOB_SQL = "(j.commercial_origin='aggregated' AND j.source<>'manual')";
export const SCRAPED_SALARY_SQL = `(${SCRAPED_JOB_SQL} AND ${RELIABLE_SALARY_SQL})`;

/** The same cohort threshold applies to all public salary dimensions and breakdowns. */
export function publicSalaryStats(rows:readonly {min:number|null;max:number|null}[]) {
  const valid=rows.filter(row=>row.min!=null&&row.max!=null&&Number.isFinite(row.min)&&Number.isFinite(row.max)&&row.min>0&&row.max>=row.min);
  if(valid.length<MIN_SALARY_SAMPLE)return null;
  const stats=averageSalary(valid)!;
  return {...stats,count:valid.length};
}
