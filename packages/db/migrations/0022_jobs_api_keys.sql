CREATE TABLE jobs_api_keys (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 prefix TEXT NOT NULL,
 website TEXT NOT NULL,
 created_at TEXT NOT NULL,
 revoked_at TEXT,
 last_used_at TEXT,
 window_start INTEGER NOT NULL DEFAULT 0,
 request_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_jobs_api_keys_owner ON jobs_api_keys(user_id);
