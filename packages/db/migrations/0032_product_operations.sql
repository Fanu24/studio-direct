CREATE TABLE product_rate_limits(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,window TEXT NOT NULL,hits INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,kind,window));
CREATE INDEX idx_product_rate_window ON product_rate_limits(window);
CREATE INDEX IF NOT EXISTS idx_candidate_access_time ON candidate_access_log(recruiter_id,created_at);
ALTER TABLE support_tickets ADD COLUMN due_at TEXT;
ALTER TABLE support_tickets ADD COLUMN first_response_at TEXT;
