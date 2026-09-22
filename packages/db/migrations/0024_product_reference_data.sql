-- Additive product foundations. Existing jobs and profile privacy are unchanged.
CREATE TABLE feature_flags (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (tenant_id, name)
);

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(aliases_json)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'rejected')),
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_skills_status_name ON skills(status, name);
ALTER TABLE benefits ADD COLUMN aliases_json TEXT NOT NULL DEFAULT '[]';

-- Enforce the separation for inserts and renames, including pending skills.
CREATE TRIGGER skills_no_benefit_insert BEFORE INSERT ON skills
WHEN EXISTS (SELECT 1 FROM benefits WHERE slug=NEW.slug COLLATE NOCASE)
BEGIN SELECT RAISE(ABORT, 'A benefit cannot also be a skill'); END;
CREATE TRIGGER skills_no_benefit_update BEFORE UPDATE OF slug ON skills
WHEN EXISTS (SELECT 1 FROM benefits WHERE slug=NEW.slug COLLATE NOCASE)
BEGIN SELECT RAISE(ABORT, 'A benefit cannot also be a skill'); END;
CREATE TRIGGER benefits_no_skill_insert BEFORE INSERT ON benefits
WHEN EXISTS (SELECT 1 FROM skills WHERE slug=NEW.slug COLLATE NOCASE)
BEGIN SELECT RAISE(ABORT, 'A skill cannot also be a benefit'); END;
CREATE TRIGGER benefits_no_skill_update BEFORE UPDATE OF slug ON benefits
WHEN EXISTS (SELECT 1 FROM skills WHERE slug=NEW.slug COLLATE NOCASE)
BEGIN SELECT RAISE(ABORT, 'A skill cannot also be a benefit'); END;

CREATE TABLE reference_countries (
  code TEXT PRIMARY KEY CHECK (length(code)=2),
  name TEXT NOT NULL,
  continent TEXT NOT NULL
);
CREATE TABLE reference_cities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  search_name TEXT NOT NULL,
  region TEXT NOT NULL,
  country_code TEXT NOT NULL REFERENCES reference_countries(code),
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  timezone TEXT NOT NULL,
  population INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_reference_city_search ON reference_cities(search_name COLLATE NOCASE);
CREATE INDEX idx_reference_city_country ON reference_cities(country_code, population DESC);
CREATE TABLE reference_languages (
  code TEXT PRIMARY KEY CHECK (length(code)=2),
  name TEXT NOT NULL,
  native_name TEXT NOT NULL
);
CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('country', 'continent', 'region')),
  country_codes_json TEXT NOT NULL CHECK (json_valid(country_codes_json)),
  UNIQUE (name)
);
CREATE TABLE job_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  aliases_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(aliases_json)),
  patterns_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(patterns_json))
);
CREATE TABLE fx_rates (
  currency TEXT PRIMARY KEY,
  rate_to_usd REAL NOT NULL CHECK (rate_to_usd>0),
  updated_at TEXT NOT NULL,
  source TEXT NOT NULL
);
CREATE TABLE reference_imports (
  dataset TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  row_count INTEGER NOT NULL CHECK (row_count>=0),
  imported_at TEXT NOT NULL
);
