-- Compatibility storage remains in place. Product flags control the new readers/writers.
ALTER TABLE jobs ADD COLUMN commercial_origin TEXT NOT NULL DEFAULT 'aggregated' CHECK (commercial_origin IN ('aggregated','native','native_ats'));
ALTER TABLE jobs ADD COLUMN description_text TEXT;
ALTER TABLE jobs ADD COLUMN salary_currency TEXT;
ALTER TABLE jobs ADD COLUMN salary_period TEXT CHECK (salary_period IN ('yearly','monthly','hourly'));
ALTER TABLE jobs ADD COLUMN hide_salary INTEGER NOT NULL DEFAULT 0 CHECK (hide_salary IN (0,1));
ALTER TABLE jobs ADD COLUMN crypto_payment_available INTEGER NOT NULL DEFAULT 0 CHECK (crypto_payment_available IN (0,1));
ALTER TABLE jobs ADD COLUMN published_at TEXT;
ALTER TABLE jobs ADD COLUMN bumped_at TEXT;
ALTER TABLE jobs ADD COLUMN pinned_until TEXT;
ALTER TABLE jobs ADD COLUMN early_access_until TEXT;
ALTER TABLE jobs ADD COLUMN confidential INTEGER NOT NULL DEFAULT 0 CHECK (confidential IN (0,1));
ALTER TABLE jobs ADD COLUMN job_role_id TEXT REFERENCES job_roles(id);
ALTER TABLE employer_orders ADD COLUMN offer_version INTEGER NOT NULL DEFAULT 1 CHECK (offer_version IN (1,2));
UPDATE jobs SET commercial_origin='native',salary_currency='USD',salary_period='yearly',published_at=posted_at,pinned_until=featured_until
  WHERE source='manual' AND EXISTS(SELECT 1 FROM employer_listings e WHERE e.job_id=jobs.id);
CREATE INDEX idx_jobs_product_order ON jobs(tenant_id,listed,confidential,pinned_until,published_at,bumped_at);
CREATE INDEX idx_jobs_crypto_pay ON jobs(tenant_id,crypto_payment_available,listed);

CREATE TABLE job_skills (
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  kind TEXT NOT NULL CHECK (kind IN ('required','preferred')),
  PRIMARY KEY(job_id,skill_id)
);
CREATE TABLE job_language_requirements (
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL REFERENCES reference_languages(code),
  level TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2','C1','C2','Native')),
  kind TEXT NOT NULL CHECK (kind IN ('required','preferred')),
  PRIMARY KEY(job_id,language_code)
);
CREATE TABLE job_cities (
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  city_id INTEGER NOT NULL REFERENCES reference_cities(id),
  PRIMARY KEY(job_id,city_id)
);
CREATE TABLE job_remote_eligibility (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('geo','timezone')),
  rules_json TEXT NOT NULL CHECK (json_valid(rules_json))
);
ALTER TABLE companies ADD COLUMN company_x_url TEXT;
ALTER TABLE companies ADD COLUMN company_linkedin_url TEXT;
ALTER TABLE companies ADD COLUMN pending_publication INTEGER NOT NULL DEFAULT 0 CHECK (pending_publication IN (0,1));
CREATE TABLE native_listing_details (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  input_json TEXT NOT NULL CHECK (json_valid(input_json)),
  addons_json TEXT NOT NULL CHECK (json_valid(addons_json)),
  updated_at TEXT NOT NULL
);

CREATE TABLE company_claim_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  company_url TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents>=0),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency='usd'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','refunded')),
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE TABLE company_purchase_entitlements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  kind TEXT NOT NULL CHECK (kind IN ('job','annual_plan','claim')),
  source_id TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','refunded','revoked')),
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(kind,source_id)
);
CREATE UNIQUE INDEX idx_company_claim_pending_checkout ON company_claim_orders(company_id) WHERE status='pending';
CREATE INDEX idx_company_purchase_access ON company_purchase_entitlements(tenant_id,user_id,status);
CREATE TABLE company_claims (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  entitlement_id TEXT NOT NULL REFERENCES company_purchase_entitlements(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','revoked')),
  verified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  verification_method TEXT CHECK (verification_method IN ('email_domain','admin')),
  created_at TEXT NOT NULL,
  verified_at TEXT,
  reason TEXT,
  UNIQUE(entitlement_id)
);
CREATE UNIQUE INDEX idx_company_single_owner_claim ON company_claims(company_id) WHERE status='approved';
CREATE TABLE product_billing_events (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  type TEXT NOT NULL,
  processed_at TEXT NOT NULL
);

-- Existing paid posts include a claim too; none are automatically verified as owners.
INSERT INTO company_purchase_entitlements(id,tenant_id,user_id,company_id,kind,source_id,stripe_payment_intent_id,created_at)
SELECT 'purchase:legacy-job:'||j.id,j.tenant_id,l.user_id,j.company_id,'job',j.id,o.stripe_payment_intent_id,COALESCE(o.paid_at,j.created_at)
FROM employer_listings l JOIN jobs j ON j.id=l.job_id JOIN employer_orders o ON o.id=l.order_id
WHERE o.status='paid' AND o.offer_version=1 AND l.user_id IS NOT NULL AND l.user_id=o.user_id AND j.tenant_id=o.tenant_id
AND NOT EXISTS(SELECT 1 FROM payment_reversals r WHERE r.payment_intent_id=o.stripe_payment_intent_id);
INSERT INTO company_claims(id,tenant_id,user_id,company_id,entitlement_id,created_at)
SELECT 'claim:'||MIN(id),tenant_id,user_id,company_id,MIN(id),MIN(created_at)
FROM company_purchase_entitlements WHERE status='active' GROUP BY tenant_id,user_id,company_id;
