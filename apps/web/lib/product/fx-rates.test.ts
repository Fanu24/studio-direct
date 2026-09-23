import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {parseFxRates,refreshFxRates,SALARY_CURRENCIES} from '@gaming/shared';
import {testDatabase} from '../test-db';
let state:ReturnType<typeof testDatabase>;
const now=new Date();
const response=()=>({result:'success',base_code:'USD',time_last_update_unix:Math.floor(now.getTime()/1000),rates:{...Object.fromEntries(SALARY_CURRENCIES.map(c=>[c,2])),USD:1,EUR:0.8}});
beforeEach(()=>{state=testDatabase();});afterEach(()=>state.sql.close());
it('normalizes the provider base correctly, saves all currencies atomically and requests no more than daily',async()=>{
  const fetcher=vi.fn(async()=>Response.json(response()));
  expect(await refreshFxRates(state.db,fetcher,now)).toEqual({status:'updated',count:20});
  expect(state.sql.prepare("SELECT rate_to_usd FROM fx_rates WHERE currency='EUR'").get().rate_to_usd).toBe(1.25);
  expect(await refreshFxRates(state.db,fetcher,new Date(now.getTime()+3600000))).toEqual({status:'cached'});expect(fetcher).toHaveBeenCalledTimes(1);
});
it('keeps the last good rates when a response is incomplete and records a retryable failure',async()=>{
  const fetcher=vi.fn(async()=>Response.json(response()));await refreshFxRates(state.db,fetcher,now);
  const broken=response();delete (broken.rates as Record<string,number>).AED;
  await expect(refreshFxRates(state.db,async()=>Response.json(broken),new Date(now.getTime()+86400001))).rejects.toThrow('AED');
  expect(state.sql.prepare('SELECT COUNT(*) n FROM fx_rates').get().n).toBe(20);
  expect(state.sql.prepare('SELECT last_error FROM fx_refresh_state').get().last_error).toContain('previous rates retained');
});
it('rejects wrong base, future/stale observations and invalid rates',()=>{
  for(const data of [{...response(),base_code:'EUR'},{...response(),time_last_update_unix:1},{...response(),time_last_update_unix:Math.floor(now.getTime()/1000)+86400},{...response(),rates:{...response().rates,EUR:0}}])expect(()=>parseFxRates(data,now)).toThrow();
});
