CREATE TABLE job_extensions(order_id TEXT PRIMARY KEY REFERENCES product_orders(id),job_id TEXT NOT NULL REFERENCES jobs(id),base_expiry TEXT NOT NULL,created_at TEXT NOT NULL,days INTEGER NOT NULL DEFAULT 30,revoked INTEGER NOT NULL DEFAULT 0);
CREATE INDEX idx_job_extensions ON job_extensions(job_id,created_at);
CREATE TABLE job_view_sessions(id TEXT PRIMARY KEY,created_at TEXT NOT NULL);
CREATE INDEX idx_profile_activity ON profiles(last_active_at);
