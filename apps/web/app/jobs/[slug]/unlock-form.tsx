"use client";

import { useState, type FormEvent } from "react";

import { LockIcon } from "../../_components/icons";
import { shouldShowCompletenessNudge } from "../../../lib/profile/completeness";
import { consumeUnlockResponse } from "../../../lib/unlocks/client";

export const QUOTA_MESSAGE =
  "You've used your 5 free unlocks this week. Come back next Monday (UTC) for more.";

/* Studios do not receive a profile when you apply, so this cannot promise that they will read it. */
export const COMPLETENESS_NUDGE_MESSAGE =
  "Your profile is under 80% complete. Add experience and skills so it is ready before you apply.";

export async function submitUnlockForm(
  formData: FormData,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl("/api/unlock", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });
  return consumeUnlockResponse(response);
}

export function applyUnlockResult(result: {
  kind: "apply";
  applyUrl: string;
  completeness: number;
}):
  | { action: "nudge"; applyUrl: string; completeness: number }
  | { action: "redirect"; applyUrl: string } {
  if (shouldShowCompletenessNudge(result.completeness)) {
    return {
      action: "nudge",
      applyUrl: result.applyUrl,
      completeness: result.completeness,
    };
  }

  return { action: "redirect", applyUrl: result.applyUrl };
}

export function UnlockApplyForm({
  jobId,
  next,
}: {
  jobId: string;
  next: string;
}) {
  const [quota, setQuota] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [nudge, setNudge] = useState<{
    applyUrl: string;
    completeness: number;
  } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await submitUnlockForm(new FormData(event.currentTarget));

    if (result.kind === "apply") {
      const nextView = applyUnlockResult(result);
      if (nextView.action === "nudge") {
        setPending(false);
        setNudge({
          applyUrl: nextView.applyUrl,
          completeness: nextView.completeness,
        });
        return;
      }
      window.location.assign(nextView.applyUrl);
      return;
    }

    if (result.kind === "redirect") {
      window.location.assign(result.url);
      return;
    }

    setPending(false);

    if (result.kind === "quota") {
      setQuota(true);
      return;
    }

    setError("Could not unlock this application link. Try again.");
  }

  return (
    <div className="jd-unlock">
      <form
        action="/api/unlock"
        className="jd-unlock__form"
        method="post"
        onSubmit={onSubmit}
      >
        <input name="jobId" type="hidden" value={jobId} />
        <input name="next" type="hidden" value={next} />
        <button
          aria-busy={pending || undefined}
          className="button button--lg button--block jd-unlock__button"
          disabled={pending}
          type="submit"
        >
          <LockIcon size={18} />
          Unlock application link
        </button>
      </form>
      {quota ? (
        <div className="notice notice--accent jd-unlock__notice" role="alert">
          <p className="jd-unlock__notice-lead">{QUOTA_MESSAGE}</p>
          <a className="text-link" href="/pricing">
            Go unlimited on a paid plan
          </a>
        </div>
      ) : null}
      {error ? (
        <p className="notice notice--danger jd-unlock__notice" role="alert">
          {error}
        </p>
      ) : null}
      {nudge ? (
        <div className="notice jd-unlock__notice jd-unlock__nudge" role="status">
          <p>
            {COMPLETENESS_NUDGE_MESSAGE}
            {" "}
            Your profile is {nudge.completeness}% complete.
          </p>
          <div className="jd-unlock__actions">
            <a className="button button--sm" href={nudge.applyUrl}>
              Continue to application
            </a>
            <a className="button button--ghost button--sm" href="/profile">
              Finish your profile
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
