ALTER TABLE employer_orders ADD COLUMN renewal_status TEXT;
ALTER TABLE employer_orders ADD COLUMN renewal_next_at TEXT;
ALTER TABLE employer_orders ADD COLUMN subscription_event_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN moderation_hidden INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER jobs_keep_moderated_hidden AFTER UPDATE OF listed ON jobs WHEN NEW.listed=1 AND NEW.moderation_hidden=1 BEGIN
 UPDATE jobs SET listed=0 WHERE id=NEW.id;
END;
