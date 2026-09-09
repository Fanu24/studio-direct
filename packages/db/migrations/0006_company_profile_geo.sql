-- Company logo/domain profile support (location hierarchy uses the existing
-- job_locations junction table with multiple rows per job; no schema change
-- is needed for that part of the gap).
ALTER TABLE companies ADD COLUMN logo_url TEXT;
