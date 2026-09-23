CREATE TABLE featured_members(date TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,selected_at TEXT NOT NULL,source TEXT NOT NULL CHECK(source IN ('auto','admin')));
CREATE TABLE profile_views(id TEXT PRIMARY KEY,candidate_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,viewer_company_id TEXT REFERENCES companies(id),session_hash TEXT NOT NULL,viewed_at TEXT NOT NULL);
CREATE INDEX idx_profile_views_time ON profile_views(candidate_id,viewed_at);
CREATE UNIQUE INDEX idx_profile_view_hour ON profile_views(candidate_id,session_hash,substr(viewed_at,1,13));
CREATE UNIQUE INDEX idx_job_event_session ON job_events(job_id,type,session_hash,substr(created_at,1,13)) WHERE session_hash IS NOT NULL;
CREATE TABLE product_daily_runs(kind TEXT NOT NULL,date TEXT NOT NULL,finished_at TEXT NOT NULL,PRIMARY KEY(kind,date));
CREATE TABLE product_operations_leases(kind TEXT PRIMARY KEY,lease_until TEXT NOT NULL,token TEXT NOT NULL);
