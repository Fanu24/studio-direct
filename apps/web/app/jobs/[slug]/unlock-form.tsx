"use client";

import { useState, type FormEvent } from "react";

import { shouldShowCompletenessNudge } from "../../../lib/profile/completeness";
import { consumeUnlockResponse } from "../../../lib/unlocks/client";

export const QUOTA_MESSAGE =
  "You've used your 5 free unlocks this week. Come back next Monday (UTC) for more.";

export const COMPLETENESS_NUDGE_MESSAGE =
  "Your profile is under 80% complete. Add experience and skills so studios can learn more about you.";

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
  const [nudge, setNudge] = useState<{
    applyUrl: string;
    completeness: number;
  } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await submitUnlockForm(new FormData(event.currentTarget));

    if (result.kind === "apply") {
      const nextView = applyUnlockResult(result);
      if (nextView.action === "nudge") {
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

    if (result.kind === "quota") {
      setQuota(true);
      return;
    }

    setError("Could not unlock this application link. Try again.");
  }

  return (
    <>
      {quota ? (
        <p className="alert" role="alert">
          {QUOTA_MESSAGE}
        </p>
      ) : null}
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {nudge ? (
        <p role="status">
          {COMPLETENESS_NUDGE_MESSAGE}
          {" "}
          Your profile is {nudge.completeness}% complete.
          {" "}
          <a href="/profile">Finish your profile</a>
          {" · "}
          <a href={nudge.applyUrl}>Continue to application</a>
        </p>
      ) : null}
      <form action="/api/unlock" method="post" onSubmit={onSubmit}>
        <input name="jobId" type="hidden" value={jobId} />
        <input name="next" type="hidden" value={next} />
        <button type="submit">Unlock application link</button>
      </form>
    </>
  );
}
