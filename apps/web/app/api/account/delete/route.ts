import {sameOrigin,type Database} from '../../../../lib/platform';
import {prepareCommerceDeletion} from '../../../../lib/billing/reversals';
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createAuth, type AuthEnv } from "../../../../lib/auth/index";
import {
  deleteAccount,
  type AccountDeleteDatabase,
  type AccountFiles,
} from "../../../../lib/profile/delete-account";

type DeleteRouteEnv = AuthEnv & {
  DB: AccountDeleteDatabase & Database;
  STRIPE_SECRET_KEY?:string;
  FILES: AccountFiles;
};

async function deleteEnv(): Promise<DeleteRouteEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as DeleteRouteEnv;
}

/**
 * The phrase the account holder has to type to confirm. Checked on the server,
 * not only by the form: until this existed, a single click on the settings page
 * destroyed the account with no confirmation of any kind, which QA verified by
 * hand on a disposable account. The browser's own `required` and `pattern`
 * attributes stop the stray click; this stops everything else.
 */
// Not exported: a Next route module may only export the HTTP handlers and a
// fixed set of config keys, and anything else fails the generated type check.
const DELETE_CONFIRMATION = "DELETE";

async function confirmationPhrase(request: Request): Promise<string | null> {
  try {
    const form = await request.formData();
    const value = form.get("confirm");
    return typeof value === "string" ? value.trim() : null;
  } catch {
    // Not a form submission. Treat it as unconfirmed rather than guessing.
    return null;
  }
}

export async function POST(request: Request) {
  if(!sameOrigin(request))return Response.json({code:'invalid_origin'},{status:403});
  const env = await deleteEnv();
  const session = await createAuth(env).api.getSession({
    headers: request.headers,
  });
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return Response.json({ code: "unauthorized" }, { status: 401 });
  }

  if ((await confirmationPhrase(request)) !== DELETE_CONFIRMATION) {
    return Response.json({ code: "confirmation_required" }, { status: 400 });
  }

  try {await prepareCommerceDeletion(env.DB,userId,env.STRIPE_SECRET_KEY);}catch{return Response.json({code:'billing_cancellation_failed',message:'Recurring billing could not be cancelled. Your account has been retained.'},{status:503});}
  const applications=await (env.DB as Database).prepare('SELECT cv_r2_key FROM job_applications WHERE user_id=?').bind(userId).all<{cv_r2_key:string|null}>();
  for(const application of applications.results)if(application.cv_r2_key)await env.FILES.delete(application.cv_r2_key);
  await (env.DB as Database).prepare('DELETE FROM job_applications WHERE user_id=?').bind(userId).run();
  const privateFiles=await (env.DB as Database).prepare('SELECT evidence_key AS key FROM candidate_verification_requests WHERE user_id=? UNION ALL SELECT r2_key AS key FROM review_work_evidence WHERE user_id=?').bind(userId,userId).all<{key:string|null}>();
  for(const file of privateFiles.results)if(file.key)await env.FILES.delete(file.key);
  await env.FILES.delete('profile-photos/'+userId);
  await env.DB.batch([
    (env.DB as Database).prepare('DELETE FROM support_tickets WHERE user_id=?').bind(userId),
    (env.DB as Database).prepare('DELETE FROM support_replies WHERE user_id=?').bind(userId),
    (env.DB as Database).prepare("UPDATE company_ats_jobs SET raw_json='{}',posting_json=NULL WHERE integration_id IN(SELECT i.id FROM company_ats_integrations i JOIN company_plans p ON p.company_id=i.company_id WHERE p.owner_user_id=?)").bind(userId),
    (env.DB as Database).prepare("UPDATE candidate_verification_requests SET evidence_key=NULL,status='deleted',reason=NULL WHERE user_id=?").bind(userId),
    (env.DB as Database).prepare('DELETE FROM company_reviews WHERE user_id=?').bind(userId),
    (env.DB as Database).prepare("UPDATE product_orders SET payload_json='{}',status=CASE WHEN status='pending' THEN 'expired' ELSE status END WHERE user_id=?").bind(userId),
    (env.DB as Database).prepare("UPDATE company_ats_integrations SET enabled=0 WHERE company_id IN(SELECT company_id FROM company_plans WHERE owner_user_id=?)").bind(userId),
  ]);
  await deleteAccount({
    userId,
    db: env.DB,
    files: env.FILES,
  });

  return Response.redirect(new URL("/", request.url), 303);
}
