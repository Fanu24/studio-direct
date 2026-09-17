CREATE TABLE source_catalog (
  id TEXT PRIMARY KEY NOT NULL,
  origin TEXT NOT NULL,
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  market_rank INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  career_url TEXT,
  ats_type TEXT,
  ats_slug TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  company_id TEXT REFERENCES companies(id),
  checked_at TEXT,
  error TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_source_catalog_due ON source_catalog(active,checked_at);
CREATE TABLE discovery_state (
  id TEXT PRIMARY KEY NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  error TEXT
);
ALTER TABLE companies ADD COLUMN last_crawled_at TEXT;
ALTER TABLE companies ADD COLUMN last_crawl_error TEXT;
