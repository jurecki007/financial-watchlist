import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Auth gate for every matching request, so protection is the default. */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Auth routes are matched deliberately — public pages still need the
    // session refreshed. robots.txt and sitemap.xml are not: crawlers carry no
    // cookies, so the getUser() round-trip would confirm what we already know.
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
