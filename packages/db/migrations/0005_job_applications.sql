CREATE TABLE IF NOT EXISTS job_applications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  profile_url TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_applications_job_email
  ON job_applications (job_id, email);
