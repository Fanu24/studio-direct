PRAGMA defer_foreign_keys = ON;
CREATE TABLE employer_orders_replacement (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK(kind IN ('job','bundle')),
  payload_json TEXT NOT NULL,
  selection_json TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','refunded','cancelled')),
  stripe_session_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
INSERT INTO employer_orders_replacement SELECT * FROM employer_orders;
DROP TABLE employer_orders;
ALTER TABLE employer_orders_replacement RENAME TO employer_orders;
CREATE TABLE employer_listings_replacement (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id),
  order_id TEXT NOT NULL REFERENCES employer_orders(id),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  apply_mode TEXT NOT NULL CHECK(apply_mode IN ('internal','external')),
  contact_email TEXT NOT NULL,
  highlight_color TEXT,
  logo_url TEXT,
  support INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  closed_at TEXT
);
INSERT INTO employer_listings_replacement SELECT * FROM employer_listings;
DROP TABLE employer_listings;
ALTER TABLE employer_listings_replacement RENAME TO employer_listings;
CREATE TABLE bundle_credits_replacement (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES employer_orders(id),
  slot INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selection_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  job_id TEXT UNIQUE REFERENCES jobs(id),
  UNIQUE(order_id,slot)
);
INSERT INTO bundle_credits_replacement SELECT * FROM bundle_credits;
DROP TABLE bundle_credits;
ALTER TABLE bundle_credits_replacement RENAME TO bundle_credits;
CREATE TABLE support_requests_replacement (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES employer_orders(id),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  reply TEXT
);
INSERT INTO support_requests_replacement SELECT * FROM support_requests;
DROP TABLE support_requests;
ALTER TABLE support_requests_replacement RENAME TO support_requests;
CREATE INDEX idx_employer_orders_user ON employer_orders(user_id,created_at);
CREATE INDEX idx_employer_listings_user ON employer_listings(user_id);
CREATE INDEX idx_bundle_credits_available ON bundle_credits(user_id,job_id,expires_at);
ALTER TABLE employer_orders ADD COLUMN stripe_payment_intent_id TEXT;
