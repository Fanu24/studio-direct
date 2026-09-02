-- Existing DBs applied 0001 with a non-unique idx_jobs_slug.
-- Fresh installs already have idx_jobs_tenant_slug_unique from 0001.

DROP INDEX IF EXISTS idx_jobs_slug;

UPDATE jobs
SET slug = (
  SELECT c.name_norm || '-' || jobs.title_norm
  FROM companies c
  WHERE c.id = jobs.company_id
)
WHERE EXISTS (SELECT 1 FROM companies c WHERE c.id = jobs.company_id);

UPDATE jobs
SET slug = slug || '-' || substr(replace(id, '-', ''), 1, 8)
WHERE id IN (
  SELECT j.id
  FROM jobs j
  WHERE EXISTS (
    SELECT 1
    FROM jobs older
    WHERE older.tenant_id = j.tenant_id
      AND older.slug = j.slug
      AND older.id < j.id
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_tenant_slug_unique ON jobs (tenant_id, slug);
