CREATE TABLE marketplace_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
-- Recruiter pricing is deliberately unset until the owner chooses a tariff.
INSERT INTO marketplace_settings(key,value) VALUES('recruiter_price_cents','0');
CREATE TABLE recruiter_accounts (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 company TEXT NOT NULL,website TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','verified','rejected')),
 created_at TEXT NOT NULL
);
CREATE TABLE marketplace_orders (
 id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 kind TEXT NOT NULL CHECK(kind IN('recruiter','sponsor')),payload_json TEXT NOT NULL,
 total_cents INTEGER NOT NULL CHECK(total_cents>0),status TEXT NOT NULL DEFAULT 'pending',
 stripe_session_id TEXT UNIQUE,stripe_customer_id TEXT,stripe_payment_intent_id TEXT,
 created_at TEXT NOT NULL,paid_at TEXT,expires_at TEXT
);
CREATE INDEX idx_marketplace_owner ON marketplace_orders(user_id,kind,status,expires_at);
CREATE TABLE sponsor_slots (slot INTEGER PRIMARY KEY CHECK(slot BETWEEN 1 AND 4),order_id TEXT UNIQUE REFERENCES marketplace_orders(id));
INSERT INTO sponsor_slots(slot) VALUES(1),(2),(3),(4);
CREATE TABLE marketplace_events(id TEXT PRIMARY KEY,order_id TEXT REFERENCES marketplace_orders(id),type TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE sponsor_metrics(order_id TEXT NOT NULL REFERENCES marketplace_orders(id),day TEXT NOT NULL,views INTEGER NOT NULL DEFAULT 0,clicks INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(order_id,day));
ALTER TABLE support_requests ADD COLUMN reply TEXT;
ALTER TABLE profiles ADD COLUMN public_profile INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN bio TEXT;
ALTER TABLE profiles ADD COLUMN website TEXT;
ALTER TABLE profiles ADD COLUMN languages TEXT;
ALTER TABLE profiles ADD COLUMN experience_years INTEGER;
CREATE TABLE candidate_access_log(id TEXT PRIMARY KEY,recruiter_id TEXT REFERENCES users(id) ON DELETE SET NULL,candidate_id TEXT REFERENCES users(id) ON DELETE SET NULL,kind TEXT NOT NULL,created_at TEXT NOT NULL);
