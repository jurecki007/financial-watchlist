import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Auth gate. CLAUDE.md rule 7: unauthenticated users must never reach a
 * dashboard route, enforced here rather than per-component.
 *
 * Per-component checks fail open — a new page that forgets the check is
 * unprotected, and nothing tells you. This runs before every matching request,
 * so protection is the default and exposure requires an explicit edit to the
 * matcher below.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Auth routes are included
     * deliberately: the session still needs refreshing on public pages, or a
     * user's token expires while they read the landing page and they appear
     * signed out the moment they navigate.
     *
     * robots.txt and sitemap.xml are excluded because they are the two routes
     * that never have a session to refresh. They are fetched by crawlers, which
     * carry no cookies, so running the gate on them spends a Supabase getUser()
     * round-trip per crawl to confirm what is already known: nobody is signed
     * in. Excluding them is a cost decision, not a security one — neither is
     * protected, and neither is reachable by isProtected().
     */
    "/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
