CREATE TABLE listing_details (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  input_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE job_applications ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE job_applications ADD COLUMN cv_r2_key TEXT;
ALTER TABLE job_applications ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE job_applications ADD COLUMN employer_note TEXT NOT NULL DEFAULT '';
ALTER TABLE job_applications ADD COLUMN updated_at TEXT;
CREATE TABLE notification_outbox (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  application_id TEXT REFERENCES job_applications(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  destination_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  sent_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  retry_at TEXT,
  lease_until TEXT,
  lease_token TEXT,
  last_error TEXT
);
CREATE INDEX idx_notification_pending ON notification_outbox(sent_at,retry_at);
