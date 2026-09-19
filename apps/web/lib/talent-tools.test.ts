import {afterEach,beforeEach,it,expect} from 'vitest';
import {testDatabase} from './test-db';
import {listTalent,exportTalent,csvCell} from './talent';
let state:ReturnType<typeof testDatabase>;
beforeEach(()=>{state=testDatabase();state.sql.exec(`INSERT INTO users(id,tenant_id,email,created_at) VALUES('recruiter','tenant:gaming','r@example.test','2026-09-19'),('public','tenant:gaming','public@example.test','2026-09-19'),('shared','tenant:gaming','shared@example.test','2026-09-19'),('export','tenant:gaming','export@example.test','2026-09-19'),('hidden','tenant:gaming','hidden@example.test','2026-09-19');
 INSERT INTO profiles(user_id,public_profile,talent_pool_opt_in,talent_export_opt_in,experience_years,salary_min,languages,location) VALUES('public',1,0,0,5,100000,'English','London'),('shared',0,1,0,3,80000,'English','London'),('export',0,1,1,6,90000,'English,Italian','Rome'),('hidden',0,0,1,7,80000,'English','Rome');
 INSERT INTO recruiter_accounts VALUES('recruiter','Fixture','https://example.com','verified','2026-09-19');
 INSERT INTO marketplace_orders(id,user_id,kind,payload_json,total_cents,status,created_at,expires_at) VALUES('access','recruiter','recruiter','{}',19900,'paid','2026-09-19','2099-01-01');`);});afterEach(()=>state.sql.close());
it('keeps private candidates outside public search and combines paid professional filters',async()=>{
 expect((await listTalent(state.db,{})).rows.map(p=>p.user_id)).toEqual(['public']);
 expect((await listTalent(state.db,{experience:4,salaryMax:95000,language:'Italian'},'recruiter')).rows.map(p=>p.user_id)).toEqual(['export']);
});
it('exports only explicit current consent, records access, and refuses expired or revoked purchases',async()=>{
 const result=await exportTalent(state.db,'recruiter',{});expect(result.count).toBe(1);expect(result.csv).toContain('export@example.test');expect(result.csv).not.toContain('shared@example.test');expect(result.csv).not.toContain('hidden@example.test');
 expect(state.sql.prepare('SELECT candidate_id FROM candidate_access_log').get().candidate_id).toBe('export');state.sql.exec("UPDATE profiles SET talent_export_opt_in=0 WHERE user_id='export'");expect((await exportTalent(state.db,'recruiter',{})).count).toBe(0);
 state.sql.exec("UPDATE marketplace_orders SET status='refunded'");await expect(exportTalent(state.db,'recruiter',{})).rejects.toThrow('access required');
});
it('escapes CSV formulas, quotes and newlines',()=>{expect(csvCell('=HYPERLINK("https://example.com")')).toBe('"\'=HYPERLINK(""https://example.com"")"');expect(csvCell('\n+cmd')).toBe('"\'\n+cmd"');});
