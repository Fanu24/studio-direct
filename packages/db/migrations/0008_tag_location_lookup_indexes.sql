-- Index the columns the programmatic-SEO surface actually filters by.
--
-- Measured on the first day in production: 1,283 read queries on gaming-jobs
-- read 16,180,262 rows - about 12,600 rows per query, and over three times
-- D1's free-tier daily cap of 5,000,000. Once that cap is hit every DB-backed
-- page renders Next's 500 while the worker itself still reports outcome: ok,
-- so nothing in the platform metrics looks like a failure.
--
-- The cause is not traffic. Both join tables carry only a composite primary
-- key whose FIRST column is job_id:
--
--   job_tags       PRIMARY KEY (job_id, tag_slug)
--   job_locations  PRIMARY KEY (job_id, location_slug)
--
-- SQLite can use those to answer "which tags does this job have", which is the
-- rare direction. Every landing page asks the opposite question - "which jobs
-- carry this tag / this location" - and a composite index cannot be seeked on
-- its second column, so each of those queries scans the whole table. That is
-- the entire programmatic surface: /hire, every /{tag}-jobs landing, the city,
-- country and region directories, and the salary charts.
--
-- Both indexes are declared in the opposite column order, which also makes
-- them covering: these tables have exactly two columns, so a tag or location
-- lookup is answered from the index without touching the table at all.
--
-- salary_rollups deliberately gets nothing: its PRIMARY KEY (dimension, slug)
-- already leads with the column its queries filter on.

CREATE INDEX IF NOT EXISTS idx_job_tags_tag ON job_tags (tag_slug, job_id);

CREATE INDEX IF NOT EXISTS idx_job_locations_location
  ON job_locations (location_slug, job_id);
