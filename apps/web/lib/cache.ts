export const PUBLIC_REVALIDATE_SECONDS = 300;
export const PRIVATE_CACHE_CONTROL = "private, no-store";

export function cacheControlForRequest({
  revalidate,
  hasCookies,
}: {
  revalidate: number | undefined;
  hasCookies: boolean;
}) {
  if (revalidate === undefined || hasCookies) {
    return PRIVATE_CACHE_CONTROL;
  }

  return `public, s-maxage=${revalidate}`;
}

export function isPublicRevalidatedPath(pathname: string) {
  return pathname === "/"
    || pathname === "/jobs"
    || pathname === "/hidden-jobs"
    || pathname === "/companies"
    || pathname === "/roles"
    || pathname === "/about"
    || /^\/jobs\/[^/]+$/.test(pathname)
    || /^\/companies\/[^/]+$/.test(pathname)
    || /^\/skills\/[^/]+$/.test(pathname)
    || /^\/remote-[^/]+-jobs$/.test(pathname);
}
