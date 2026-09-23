CREATE TABLE product_orders(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 company_id TEXT REFERENCES companies(id),kind TEXT NOT NULL CHECK(kind IN ('company_plan','candidate_premium','verification','invite_pack','extension')),
 choice TEXT NOT NULL,payload_json TEXT NOT NULL DEFAULT '{}',total_cents INTEGER NOT NULL,currency TEXT NOT NULL DEFAULT 'usd',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired','refunded')),stripe_session_id TEXT UNIQUE,stripe_subscription_id TEXT UNIQUE,stripe_customer_id TEXT,stripe_payment_intent_id TEXT,created_at TEXT NOT NULL,paid_at TEXT
);
CREATE UNIQUE INDEX idx_pending_candidate_plan ON product_orders(user_id) WHERE kind='candidate_premium' AND status='pending';
CREATE UNIQUE INDEX idx_pending_company_plan ON product_orders(company_id) WHERE kind='company_plan' AND status='pending';
CREATE TABLE company_members(company_id TEXT NOT NULL REFERENCES companies(id),user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('owner','member')),created_at TEXT NOT NULL,PRIMARY KEY(company_id,user_id));
CREATE TABLE company_team_invitations(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),email TEXT NOT NULL,invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE UNIQUE INDEX idx_team_invitation ON company_team_invitations(company_id,email) WHERE status='pending';
CREATE TABLE company_plans(company_id TEXT PRIMARY KEY REFERENCES companies(id),owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,tier TEXT NOT NULL CHECK(tier IN ('starter','growth','scale','platinum')),provider_ref TEXT NOT NULL UNIQUE,customer_id TEXT,status TEXT NOT NULL,period_start TEXT NOT NULL,renews_at TEXT NOT NULL,cancel_at_period_end INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
CREATE TABLE company_plan_periods(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),provider_ref TEXT NOT NULL,tier TEXT NOT NULL,granted INTEGER NOT NULL,period_start TEXT NOT NULL,expires_at TEXT NOT NULL,payment_intent_id TEXT,revoked INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,UNIQUE(provider_ref,period_start));
CREATE TABLE plan_credit_reservations(order_id TEXT PRIMARY KEY REFERENCES employer_orders(id),company_id TEXT NOT NULL REFERENCES companies(id),period_id TEXT NOT NULL REFERENCES company_plan_periods(id),kind TEXT NOT NULL CHECK(kind IN ('credit','fair_use','extra')),status TEXT NOT NULL DEFAULT 'held' CHECK(status IN ('held','used','released')),created_at TEXT NOT NULL);
CREATE TABLE credit_ledger(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),period_id TEXT NOT NULL REFERENCES company_plan_periods(id),job_id TEXT REFERENCES jobs(id),order_id TEXT REFERENCES employer_orders(id),delta INTEGER NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(order_id,reason));
ALTER TABLE jobs ADD COLUMN bumps_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN plan_tier TEXT;
ALTER TABLE jobs ADD COLUMN plan_credit_id TEXT REFERENCES company_plan_periods(id);
ALTER TABLE companies ADD COLUMN banner_url TEXT;
ALTER TABLE companies ADD COLUMN headquarters TEXT;
ALTER TABLE companies ADD COLUMN size TEXT;
CREATE INDEX idx_company_plan_period ON company_plan_periods(company_id,expires_at,revoked);
CREATE TABLE product_subscription_invoices(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES product_orders(id),provider_ref TEXT NOT NULL,payment_intent_id TEXT,period_start TEXT NOT NULL,period_end TEXT NOT NULL,amount_paid INTEGER NOT NULL,hosted_url TEXT,revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE candidate_verification_requests(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,order_id TEXT NOT NULL UNIQUE REFERENCES product_orders(id),status TEXT NOT NULL DEFAULT 'awaiting_evidence',evidence_key TEXT,submitted_at TEXT,reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,reviewed_at TEXT,reason TEXT,created_at TEXT NOT NULL);
CREATE TABLE talent_invite_packs(id TEXT PRIMARY KEY REFERENCES product_orders(id),company_id TEXT NOT NULL REFERENCES companies(id),quantity INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,revoked INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
CREATE TABLE product_admin_audit(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,action TEXT NOT NULL,subject_id TEXT NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL);
INSERT OR IGNORE INTO company_members SELECT company_id,user_id,'owner',COALESCE(verified_at,created_at) FROM company_claims WHERE status='approved' AND user_id IS NOT NULL;
