import {describe,it,expect} from 'vitest';
import {testDatabase} from './test-db';
import {moderateJob} from './moderation';
function fixture(){const {sql,db}=testDatabase();sql.exec(`
 INSERT INTO companies(id,tenant_id,name,name_norm,listed,created_at) VALUES('c','tenant:gaming','Acme','acme',1,'2026-01-01');
 INSERT INTO jobs(id,tenant_id,company_id,canonical_key,title,title_norm,slug,source,apply_url,remote,description_html,exclusivity,posted_at,listed,created_at,updated_at)
 VALUES('j','tenant:gaming','c','test:j','Engineer','engineer','test-job','career_page','https://example.com/job','remote','<p>Test</p>','unknown','2026-09-21',1,'2026-01-01','2026-01-01');`);return {sql,db};}
describe('moderation availability',()=>{
 it('restores an active vacancy after repeated hiding and leaves an already-closed vacancy closed',async()=>{
  const {sql,db}=fixture();await moderateJob(db,'j',true);await moderateJob(db,'j',true);
  expect(sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);
  await moderateJob(db,'j',false);expect(sql.prepare('SELECT listed FROM jobs').get().listed).toBe(1);
  sql.exec('UPDATE jobs SET listed=0');await moderateJob(db,'j',true);await moderateJob(db,'j',false);
  expect(sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);sql.close();
 });
 it('does not reopen expired vacancies or sources closed while hidden',async()=>{
  const {sql,db}=fixture();await moderateJob(db,'j',true);
  sql.exec("UPDATE jobs SET listed=1");expect(sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);
  sql.exec('UPDATE jobs SET listed=0,moderation_restore_listed=0');await moderateJob(db,'j',false);
  expect(sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);
  sql.exec("UPDATE jobs SET listed=1,expires_at='2020-01-01'");await moderateJob(db,'j',true);await moderateJob(db,'j',false);
  expect(sql.prepare('SELECT listed FROM jobs').get().listed).toBe(0);sql.close();
 });
});
