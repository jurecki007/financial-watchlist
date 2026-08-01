import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthRoute, isProtected } from "@/lib/auth/routes";

/**
 * Refreshes the auth session and gates protected routes.
 *
 * Two jobs, and the order matters. Supabase access tokens are short-lived; if
 * nothing refreshes them, a user gets signed out mid-session. Middleware is the
 * only place that runs before every request and can write cookies, so it owns
 * the refresh.
 *
 * The cookie handling below looks redundant but is not: cookies must be written
 * to BOTH the request (so handlers later in this same pass see the new session)
 * and the response (so the browser stores it). Creating a fresh NextResponse
 * without copying cookies across silently drops the refreshed token, and the
 * symptom is a user being logged out at random.
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

  // getUser, not getSession — this revalidates the token against the auth
  // server. An access decision made from an unvalidated cookie is not an
  // access decision. Must run immediately after client creation and before
  // any early return, or the session is never refreshed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

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
