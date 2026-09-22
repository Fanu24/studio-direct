import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {pricing} from '../packages/shared/src/product/pricing.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'), db=new DatabaseSync(':memory:');
try {
  db.exec('PRAGMA foreign_keys=ON');
  const migrations=readdirSync(resolve(root,'packages/db/migrations')).filter(name=>name.endsWith('.sql')).sort();
  const migrate=files=>files.forEach(name=>db.exec(readFileSync(resolve(root,'packages/db/migrations',name),'utf8')));
  migrate(migrations.filter(name=>name<'0024'));
  db.exec(`INSERT INTO users(id,tenant_id,email,created_at) VALUES('upgrade-test','tenant:gaming','fixture@example.com','2026-01-01');
    INSERT INTO companies(id,tenant_id,name,name_norm,domain,created_at) VALUES('upgrade-company','tenant:gaming','Upgrade fixture','upgrade fixture','example.com','2026-01-01');`);
  const job=db.prepare(`INSERT INTO jobs(id,tenant_id,company_id,canonical_key,title,title_norm,slug,remote,description_html,apply_url,salary_min,salary_max,source,posted_at,created_at,updated_at)
    VALUES(?,'tenant:gaming','upgrade-company',?,'Upgrade fixture','upgrade fixture',?,'remote','<p>Existing listing</p>','https://example.com',100000,150000,?,'2026-01-01','2026-01-01','2026-01-01')`);
  job.run('native-fixture','native-fixture','native-fixture','manual');job.run('aggregate-fixture','aggregate-fixture','aggregate-fixture','ats');
  db.prepare(`INSERT INTO employer_orders(id,tenant_id,user_id,kind,payload_json,selection_json,total_cents,status,created_at) VALUES('historical','tenant:gaming','upgrade-test','job','{}','{}',?,'paid','2026-01-01')`).run(pricing.legacy.jobBase);
  db.exec(`INSERT INTO employer_listings(job_id,order_id,user_id,apply_mode,contact_email,expires_at) VALUES('native-fixture','historical','upgrade-test','external','fixture@example.com','2026-02-01')`);
  migrate(migrations.filter(name=>name>='0024'));
  assert.equal(db.prepare("SELECT commercial_origin FROM jobs WHERE id='native-fixture'").get().commercial_origin,'native');
  assert.equal(db.prepare("SELECT commercial_origin FROM jobs WHERE id='aggregate-fixture'").get().commercial_origin,'aggregated');
  assert.equal(db.prepare("SELECT salary_currency FROM jobs WHERE id='aggregate-fixture'").get().salary_currency,null);
  assert.equal(db.prepare("SELECT total_cents FROM employer_orders WHERE id='historical'").get().total_cents,pricing.legacy.jobBase);
  const sql=readFileSync(resolve(root,'.wrangler/reference-data/reference-import.sql'),'utf8');
  const receipt=JSON.parse(readFileSync(resolve(root,'.wrangler/reference-data/reference-import-receipt.json'),'utf8'));
  assert.equal(createHash('sha256').update(sql).digest('hex'),receipt.sha256);
  db.exec(sql);db.exec(sql);
  for(const [table,key] of [['reference_cities','cities'],['reference_countries','countries'],['reference_languages','languages'],['skills','skills'],['regions','regions'],['job_roles','roles']]) assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,receipt[key]);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM jobs').get().n,2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM feature_flags').get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM company_claims').get().n,1);
  assert.equal(db.prepare('SELECT status FROM company_claims').get().status,'pending');
  assert.equal(db.prepare('SELECT company_id FROM company_claims').get().company_id,'upgrade-company');
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  const report={status:'passed',environment:'isolated in-memory SQLite',migrationUpgrade:'0023 to current',importRuns:2,referenceSha256:receipt.sha256,
    countries:receipt.countries,cities:receipt.cities,languages:receipt.languages,skills:receipt.skills,regions:receipt.regions,roles:receipt.roles,
    existingJobsPreserved:true,historicalPricePreserved:true,includedLegacyClaimRetained:true,noAutomaticOwnershipApproval:true,noFeatureActivation:true,foreignKeysValid:true};
  writeFileSync(resolve(root,'.wrangler/reference-data/upgrade-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{db.close();}
