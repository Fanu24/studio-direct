export type UnlockClientResult =
  | { kind: "apply"; applyUrl: string }
  | { kind: "quota" }
  | { kind: "redirect"; url: string }
  | { kind: "error" };

export async function consumeUnlockResponse(
  response: Response,
): Promise<UnlockClientResult> {
  if (response.status === 402) {
    return { kind: "quota" };
  }

  const location = response.headers.get("location");
  if ((response.status === 303 || response.status === 302) && location) {
    return { kind: "redirect", url: location };
  }

  if (response.ok) {
    const body: unknown = await response.json().catch(() => null);
    if (
      body
      && typeof body === "object"
      && "applyUrl" in body
      && typeof body.applyUrl === "string"
      && body.applyUrl.length > 0
    ) {
      return { kind: "apply", applyUrl: body.applyUrl };
    }
  }

  return { kind: "error" };
}
