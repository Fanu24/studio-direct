import {SALARY_CURRENCIES} from './fields.ts';
type Statement={bind(...values:unknown[]):Statement;first<T>():Promise<T|null>;run():Promise<{meta?:{changes?:number}}>};
type FxDatabase={prepare(sql:string):Statement;batch(statements:Statement[]):Promise<unknown[]>};
export const FX_SOURCE='https://www.exchangerate-api.com';
export const FX_ENDPOINT='https://open.er-api.com/v6/latest/USD';

export function parseFxRates(value:unknown,now=new Date()){
  const data=value as {result?:string;base_code?:string;time_last_update_unix?:number;rates?:Record<string,number>};
  const at=Number(data?.time_last_update_unix)*1000;
  if(!data||data.result!=='success'||data.base_code!=='USD'||!Number.isFinite(at)||at>now.getTime()+3600000||at<now.getTime()-7*86400000||data.rates?.USD!==1)throw Error('Invalid or stale FX response');
  return SALARY_CURRENCIES.map(currency=>{
    const rate=data.rates?.[currency];if(typeof rate!=='number'||!Number.isFinite(rate)||rate<=0||rate>1e8)throw Error('Missing or invalid currency rate: '+currency);
    return {currency,rateToUsd:1/rate,updatedAt:new Date(at).toISOString(),source:FX_SOURCE};
  });
}

/** One daily fetch for every supported currency. A lease prevents concurrent cron retries. */
export async function refreshFxRates(db:FxDatabase,fetcher:typeof fetch=fetch,now=new Date()){
  const at=now.toISOString(),lease=crypto.randomUUID();
  const acquired=await db.prepare(`INSERT INTO fx_refresh_state(id,next_attempt_at,lease_token) VALUES(1,?,?)
    ON CONFLICT(id) DO UPDATE SET next_attempt_at=excluded.next_attempt_at,lease_token=excluded.lease_token
    WHERE fx_refresh_state.next_attempt_at<=? RETURNING id`).bind(new Date(now.getTime()+3600000).toISOString(),lease,at).first<{id:number}>();
  if(!acquired)return {status:'cached' as const};
  try{
    const response=await fetcher(FX_ENDPOINT,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
    if(!response.ok)throw Error('FX provider unavailable');
    const rates=parseFxRates(await response.json(),now);
    await db.batch([
      ...rates.map(rate=>db.prepare(`INSERT INTO fx_rates(currency,rate_to_usd,updated_at,source) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM fx_refresh_state WHERE id=1 AND lease_token=?)
        ON CONFLICT(currency) DO UPDATE SET rate_to_usd=excluded.rate_to_usd,updated_at=excluded.updated_at,source=excluded.source WHERE excluded.updated_at>=fx_rates.updated_at`)
        .bind(rate.currency,rate.rateToUsd,rate.updatedAt,rate.source,lease)),
      db.prepare('UPDATE fx_refresh_state SET next_attempt_at=?,last_success_at=?,last_error=NULL WHERE id=1 AND lease_token=?').bind(new Date(now.getTime()+86400000).toISOString(),at,lease),
    ]);
    return {status:'updated' as const,count:rates.length};
  }catch(error){
    await db.prepare("UPDATE fx_refresh_state SET last_error='Refresh failed; previous rates retained' WHERE id=1 AND lease_token=?").bind(lease).run();
    throw error;
  }
}
