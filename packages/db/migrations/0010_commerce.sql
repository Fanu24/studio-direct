-- Additive migration. Apply before deploying commerce routes. Safe to re-run.
CREATE TABLE IF NOT EXISTS employer_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
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
CREATE INDEX IF NOT EXISTS idx_employer_orders_user ON employer_orders(user_id, created_at);
CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES employer_orders(id),
  type TEXT NOT NULL,
  processed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS employer_listings (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id),
  order_id TEXT NOT NULL REFERENCES employer_orders(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  apply_mode TEXT NOT NULL CHECK(apply_mode IN ('internal','external')),
  contact_email TEXT NOT NULL,
  highlight_color TEXT,
  logo_url TEXT,
  support INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_employer_listings_user ON employer_listings(user_id);
CREATE TABLE IF NOT EXISTS bundle_credits (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES employer_orders(id),
  slot INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  selection_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  job_id TEXT UNIQUE REFERENCES jobs(id),
  UNIQUE(order_id,slot)
);
CREATE INDEX IF NOT EXISTS idx_bundle_credits_available ON bundle_credits(user_id, job_id, expires_at);
CREATE TABLE IF NOT EXISTS saved_jobs (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,job_id)
);
CREATE TABLE IF NOT EXISTS support_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT REFERENCES employer_orders(id),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
