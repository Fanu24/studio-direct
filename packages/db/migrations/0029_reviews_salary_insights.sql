CREATE TABLE company_reviews(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),company_id TEXT NOT NULL REFERENCES companies(id),user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 overall INTEGER NOT NULL CHECK(overall BETWEEN 1 AND 5),paid_on_time INTEGER NOT NULL CHECK(paid_on_time BETWEEN 1 AND 5),transparent_process INTEGER NOT NULL CHECK(transparent_process BETWEEN 1 AND 5),would_work_again INTEGER NOT NULL CHECK(would_work_again BETWEEN 1 AND 5),
 relationship TEXT NOT NULL CHECK(relationship IN ('contract','employee','bounty_grant')),body TEXT NOT NULL,is_anonymous INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','rejected','removed')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,published_at TEXT
);
CREATE INDEX idx_company_review_period ON company_reviews(company_id,user_id,created_at);
CREATE TABLE review_work_evidence(review_id TEXT PRIMARY KEY REFERENCES company_reviews(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,r2_key TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,reviewed_at TEXT,reason TEXT);
CREATE TABLE review_responses(review_id TEXT PRIMARY KEY REFERENCES company_reviews(id) ON DELETE CASCADE,company_id TEXT NOT NULL REFERENCES companies(id),user_id TEXT REFERENCES users(id) ON DELETE SET NULL,body TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE review_reports(id TEXT PRIMARY KEY,review_id TEXT NOT NULL REFERENCES company_reviews(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,UNIQUE(review_id,user_id));
CREATE TABLE review_moderation_history(id TEXT PRIMARY KEY,review_id TEXT NOT NULL REFERENCES company_reviews(id) ON DELETE CASCADE,admin_id TEXT REFERENCES users(id) ON DELETE SET NULL,action TEXT NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE salary_stats(role_slug TEXT NOT NULL,location_slug TEXT NOT NULL,as_of TEXT NOT NULL,stats_json TEXT NOT NULL CHECK(json_valid(stats_json)),PRIMARY KEY(role_slug,location_slug,as_of));
CREATE INDEX idx_salary_stats_latest ON salary_stats(role_slug,location_slug,as_of DESC);
