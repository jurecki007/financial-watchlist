import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthRoute, isProtected } from "@/lib/auth/routes";

/**
 * Refreshes the auth session and gates protected routes. Access tokens are
 * short-lived, and this is the only place that runs before every request and
 * can write cookies.
 *
 * Cookies go to BOTH the request (so later handlers in this pass see the new
 * session) and the response (so the browser stores it). Dropping either
 * silently signs the user out at random.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser, not getSession: an access decision from an unvalidated cookie is
  // not an access decision. Must run before any early return, or the session
  // is never refreshed. ~105ms with a session, 0ms without.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Forwarded so downstream renders need not repeat the round-trip. Set
  // unconditionally, including to empty, so a forged header cannot survive.
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", user?.id ?? "");
  requestHeaders.set("x-user-email", user?.email ?? "");
  // Server components cannot read the current path. Forwarding it here means
  // the nav can highlight the active route without every page passing it down.
  requestHeaders.set("x-pathname", pathname);

  // Rebuilding the response would discard cookies setAll() wrote while
  // refreshing, signing the user out on the next request.
  const withHeaders = NextResponse.next({ request: { headers: requestHeaders } });
  supabaseResponse.cookies.getAll().forEach((c) => withHeaders.cookies.set(c));
  supabaseResponse = withHeaders;

  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Send them back where they were headed once they authenticate.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
