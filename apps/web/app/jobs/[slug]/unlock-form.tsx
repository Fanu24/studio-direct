"use client";

import { useState, type FormEvent } from "react";

import { consumeUnlockResponse } from "../../../lib/unlocks/client";

export const QUOTA_MESSAGE =
  "You've used your 5 free unlocks this week. Come back next Monday (UTC) for more.";

export async function submitUnlockForm(
  formData: FormData,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl("/api/unlock", {
    method: "POST",
    body: formData,
    redirect: "manual",
    credentials: "same-origin",
  });
  return consumeUnlockResponse(response);
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await submitUnlockForm(new FormData(event.currentTarget));

    if (result.kind === "apply") {
      window.location.assign(result.applyUrl);
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
      {quota ? <p role="alert">{QUOTA_MESSAGE}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <form action="/api/unlock" method="post" onSubmit={onSubmit}>
        <input name="jobId" type="hidden" value={jobId} />
        <input name="next" type="hidden" value={next} />
        <button type="submit">Unlock application link</button>
      </form>
    </>
  );
}
