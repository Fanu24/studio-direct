-- Preserve source availability independently of an administrator's temporary hide.
ALTER TABLE jobs ADD COLUMN moderation_restore_listed INTEGER NOT NULL DEFAULT 0;
DROP TRIGGER jobs_keep_moderated_hidden;
CREATE TRIGGER jobs_keep_moderated_hidden AFTER UPDATE OF listed ON jobs
WHEN NEW.listed=1 AND NEW.moderation_hidden=1 BEGIN
  UPDATE jobs SET listed=0, moderation_restore_listed=1 WHERE id=NEW.id;
END;
