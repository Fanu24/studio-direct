-- Nodework catalog + programmatic SEO
UPDATE tenants
SET slug = 'nodework', name = 'Nodework'
WHERE slug = 'gaming' OR id = 'tenant:gaming';

INSERT OR IGNORE INTO tenants (id, slug, name)
VALUES ('tenant:gaming', 'nodework', 'Nodework');

ALTER TABLE jobs ADD COLUMN salary_min INTEGER;
ALTER TABLE jobs ADD COLUMN salary_max INTEGER;
ALTER TABLE jobs ADD COLUMN source TEXT NOT NULL DEFAULT 'career_page';
ALTER TABLE jobs ADD COLUMN external_id TEXT;
ALTER TABLE jobs ADD COLUMN featured_until TEXT;
ALTER TABLE jobs ADD COLUMN highlight INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_tenant_source_external
  ON jobs (tenant_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS tags (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_tags (
  job_id TEXT NOT NULL,
  tag_slug TEXT NOT NULL,
  PRIMARY KEY (job_id, tag_slug)
);

CREATE TABLE IF NOT EXISTS locations (
  slug TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_locations (
  job_id TEXT NOT NULL,
  location_slug TEXT NOT NULL,
  PRIMARY KEY (job_id, location_slug)
);

CREATE TABLE IF NOT EXISTS benefits (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_benefits (
  job_id TEXT NOT NULL,
  benefit_slug TEXT NOT NULL,
  PRIMARY KEY (job_id, benefit_slug)
);

CREATE TABLE IF NOT EXISTS salary_rollups (
  dimension TEXT NOT NULL,
  slug TEXT NOT NULL,
  avg INTEGER NOT NULL,
  min INTEGER NOT NULL,
  max INTEGER NOT NULL,
  job_count_30d INTEGER NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (dimension, slug)
);
