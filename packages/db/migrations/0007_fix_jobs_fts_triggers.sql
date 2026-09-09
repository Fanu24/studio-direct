-- Repair the jobs_fts maintenance triggers on databases migrated before the fix landed
-- in 0001_init.sql.
--
-- The original triggers removed the stale index entry with FTS5's special "delete"
-- command:
--
--   INSERT INTO jobs_fts (jobs_fts, rowid, ...) VALUES ('delete', OLD.rowid, ...);
--
-- That command only exists for external-content (content='jobs') and contentless
-- (content='') FTS5 tables. jobs_fts is a plain FTS5 table that owns its own content, and
-- against such a table the command raises SQLITE_ERROR — surfaced as the bare message
-- "SQL logic error".
--
-- Consequence: every UPDATE and every DELETE on `jobs` failed on those databases. It only
-- bit on the *second* pass over a listing, so the first import of a fresh database looked
-- healthy: re-ingesting a job (the crawler's DO UPDATE path) and closing a stale listing
-- (listed = 0) both raised. 0001_init.sql was corrected in place, but a migration that has
-- already run is never re-run, so databases created before that commit still carry the
-- broken pair and need this.
--
-- Idempotent: safe on a database that already has the correct triggers.

DROP TRIGGER IF EXISTS jobs_fts_ad;
DROP TRIGGER IF EXISTS jobs_fts_au;

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
