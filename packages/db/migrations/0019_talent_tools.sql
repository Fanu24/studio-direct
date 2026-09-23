ALTER TABLE profiles ADD COLUMN talent_export_opt_in INTEGER NOT NULL DEFAULT 0;
CREATE TABLE recruiter_shortlist (
 recruiter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 candidate_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 PRIMARY KEY(recruiter_id,candidate_id)
);
