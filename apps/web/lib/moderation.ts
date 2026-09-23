import type {Database} from './platform';

export async function moderateJob(db:Database, id:string, hidden:boolean, now=new Date().toISOString()) {
  if (hidden) {
    await db.prepare(`UPDATE jobs SET moderation_restore_listed=CASE WHEN moderation_hidden=0 THEN listed ELSE moderation_restore_listed END,
      moderation_hidden=1,listed=0 WHERE id=?`).bind(id).run();
  } else {
    await db.prepare(`UPDATE jobs SET moderation_hidden=0,
      listed=CASE WHEN (expires_at IS NULL OR julianday(expires_at)>julianday(?)) AND
        ((source!='manual' AND moderation_restore_listed=1) OR
         (source='manual' AND EXISTS(SELECT 1 FROM employer_listings WHERE job_id=jobs.id AND closed_at IS NULL AND expires_at>?)))
        THEN 1 ELSE 0 END
      WHERE id=? AND moderation_hidden=1`).bind(now,now,id).run();
  }
}
