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
    || pathname === "/roles"
    || pathname === "/about"
    || pathname === "/remote-jobs"
    // Canonical company directory. The old /companies paths stay listed because
    // they are permanent redirects onto these and are just as shareable at the
    // shared-cache layer.
    || pathname === "/web3-companies"
    || pathname === "/companies"
    // Covers /web3-companies/:slug and the static /web3-companies/top-growing.
    || /^\/web3-companies\/[^/]+$/.test(pathname)
    || /^\/web3-companies\/tag\/[^/]+$/.test(pathname)
    || /^\/companies\/[^/]+$/.test(pathname)
    || pathname === "/web3-salaries"
    || pathname === "/web3-non-tech-salaries"
    || pathname === "/web3-cities"
    || pathname === "/learn-web3"
    || /^\/jobs\/[^/]+$/.test(pathname)
    || /^\/skills\/[^/]+$/.test(pathname)
    || /^\/web3-salaries\/[^/]+$/.test(pathname)
    || /^\/web3-non-tech-salaries\/[^/]+$/.test(pathname)
    || /^\/learn-web3\/[^/]+$/.test(pathname)
    || /^\/web3-jobs-[^/]+$/.test(pathname)
    || /^\/(?:remote-)?[a-z0-9-]+-jobs$/.test(pathname);
}
