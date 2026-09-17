ALTER TABLE jobs ADD COLUMN listing_logo_url TEXT;
ALTER TABLE jobs ADD COLUMN highlight_color TEXT;
ALTER TABLE jobs ADD COLUMN expires_at TEXT;
CREATE INDEX IF NOT EXISTS idx_jobs_expiry ON jobs(expires_at) WHERE expires_at IS NOT NULL;
