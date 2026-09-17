CREATE TABLE job_alerts(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 query TEXT NOT NULL DEFAULT '',tag TEXT,remote_only INTEGER NOT NULL DEFAULT 0,
 enabled INTEGER NOT NULL DEFAULT 1,unsubscribe_token TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL,last_sent_at TEXT,last_attempt_at TEXT
);
CREATE INDEX idx_job_alerts_owner ON job_alerts(user_id);
