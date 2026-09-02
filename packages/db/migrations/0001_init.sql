CREATE TABLE tenants (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  domain TEXT
);

CREATE TABLE companies (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants (id),
  name TEXT NOT NULL,
  name_norm TEXT NOT NULL,
  domain TEXT,
  career_url TEXT,
  ats_type TEXT,
  ats_slug TEXT,
  listed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, name_norm)
);

CREATE INDEX idx_companies_tenant ON companies (tenant_id);
CREATE INDEX idx_companies_listed ON companies (listed);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants (id),
  company_id TEXT NOT NULL REFERENCES companies (id),
  canonical_key TEXT NOT NULL,
  title TEXT NOT NULL,
  title_norm TEXT NOT NULL,
  slug TEXT NOT NULL,
  location TEXT,
  remote TEXT NOT NULL,
  description_html TEXT NOT NULL,
  apply_url TEXT NOT NULL,
  salary_text TEXT,
  exclusivity TEXT NOT NULL DEFAULT 'unknown',
  seen_on_indeed INTEGER NOT NULL DEFAULT 0,
  posted_at TEXT,
  listed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_jobs_tenant_canonical_unique ON jobs (tenant_id, canonical_key);
CREATE INDEX idx_jobs_tenant_listed ON jobs (tenant_id, listed);
CREATE INDEX idx_jobs_remote ON jobs (remote);
CREATE INDEX idx_jobs_exclusivity ON jobs (exclusivity);
CREATE INDEX idx_jobs_company ON jobs (company_id);
CREATE INDEX idx_jobs_posted_at ON jobs (posted_at);
CREATE INDEX idx_jobs_slug ON jobs (slug);

CREATE TABLE job_sightings (
  id TEXT PRIMARY KEY NOT NULL,
  job_id TEXT NOT NULL REFERENCES jobs (id),
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  seen_at TEXT NOT NULL
);

CREATE INDEX idx_job_sightings_job ON job_sightings (job_id);
CREATE INDEX idx_job_sightings_source ON job_sightings (job_id, source);

CREATE VIRTUAL TABLE jobs_fts USING fts5 (
  title,
  description,
  company_name
);

CREATE TRIGGER jobs_fts_ai AFTER INSERT ON jobs BEGIN
  INSERT INTO jobs_fts (rowid, title, description, company_name)
  VALUES (
    NEW.rowid,
    NEW.title,
    NEW.description_html,
    (SELECT name FROM companies WHERE id = NEW.company_id)
  );
END;

CREATE TRIGGER jobs_fts_ad AFTER DELETE ON jobs BEGIN
  DELETE FROM jobs_fts WHERE rowid = OLD.rowid;
END;

CREATE TRIGGER jobs_fts_au AFTER UPDATE ON jobs BEGIN
  DELETE FROM jobs_fts WHERE rowid = OLD.rowid;
  INSERT INTO jobs_fts (rowid, title, description, company_name)
  VALUES (
    NEW.rowid,
    NEW.title,
    NEW.description_html,
    (SELECT name FROM companies WHERE id = NEW.company_id)
  );
END;

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants (id),
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, email)
);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users (id),
  display_name TEXT,
  headline TEXT,
  location TEXT,
  timezone TEXT,
  target_role TEXT,
  seniority TEXT,
  remote_pref TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  work_auth_text TEXT,
  completeness INTEGER NOT NULL DEFAULT 0,
  talent_pool_opt_in INTEGER NOT NULL DEFAULT 0,
  talent_pool_opt_in_at TEXT,
  talent_pool_opt_out_at TEXT,
  cv_r2_key TEXT
);

CREATE TABLE experience_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id),
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  description TEXT
);

CREATE INDEX idx_experience_user ON experience_entries (user_id);

CREATE TABLE profile_skills (
  user_id TEXT NOT NULL REFERENCES users (id),
  skill TEXT NOT NULL,
  PRIMARY KEY (user_id, skill)
);

CREATE TABLE unlocks (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id),
  job_id TEXT NOT NULL REFERENCES jobs (id),
  week_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_unlocks_user_week ON unlocks (user_id, week_id);
CREATE UNIQUE INDEX idx_unlocks_user_job_week ON unlocks (user_id, job_id, week_id);

CREATE TABLE subscriptions (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users (id),
  stripe_customer_id TEXT,
  stripe_status TEXT,
  period_end TEXT
);

CREATE TABLE consent_events (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id),
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_consent_user ON consent_events (user_id);

CREATE TABLE crawl_runs (
  id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  ok INTEGER NOT NULL DEFAULT 0,
  stats_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_crawl_runs_source_finished ON crawl_runs (source, finished_at);
