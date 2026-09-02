export type UnlockClientResult =
  | { kind: "apply"; applyUrl: string; completeness: number }
  | { kind: "quota" }
  | { kind: "redirect"; url: string }
  | { kind: "error" };

function relativeRedirect(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("redirect" in body)) return null;
  const value = body.redirect;
  if (typeof value !== "string" || value.length === 0) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return null;
  }
  return value;
}

export async function consumeUnlockResponse(
  response: Response,
): Promise<UnlockClientResult> {
  if (response.status === 402) {
    return { kind: "quota" };
  }

  const body: unknown = await response.json().catch(() => null);
  const redirect = relativeRedirect(body);
  if (redirect) {
    return { kind: "redirect", url: redirect };
  }

  if (response.ok) {
    if (
      body
      && typeof body === "object"
      && "applyUrl" in body
      && typeof body.applyUrl === "string"
      && body.applyUrl.length > 0
    ) {
      const completeness =
        "completeness" in body && typeof body.completeness === "number"
          ? body.completeness
          : 0;
      return { kind: "apply", applyUrl: body.applyUrl, completeness };
    }
  }

  return { kind: "error" };
}
