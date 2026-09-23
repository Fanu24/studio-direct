import { NextResponse, type NextRequest } from "next/server";

import {
  PUBLIC_REVALIDATE_SECONDS,
  cacheControlForRequest,
  isPublicRevalidatedPath,
} from "./lib/cache";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (process.env.SITE_INDEXING_ENABLED === "false") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  const revalidate = isPublicRevalidatedPath(request.nextUrl.pathname)
    ? PUBLIC_REVALIDATE_SECONDS
    : undefined;

  response.headers.set(
    "Cache-Control",
    cacheControlForRequest({
      revalidate,
      hasCookies: request.cookies.size > 0,
    }),
  );

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
