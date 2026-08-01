import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/auth/routes";

/**
 * OAuth and email-confirmation landing point.
 *
 * Supabase sends the user back here with a one-time code; exchanging it for a
 * session is what actually signs them in. The exchange must happen server-side
 * so the session cookie is set on a response the browser will store.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // Same open-redirect guard as the server actions, from one shared
  // implementation so the two cannot drift apart.
  const next = safeRedirectPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
