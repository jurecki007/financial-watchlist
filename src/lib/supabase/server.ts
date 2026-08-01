import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for server components, route handlers, and server actions.
 *
 * Still the publishable key — this is the *user's* session on the server, not
 * an admin client. It reads whatever the signed-in user is allowed to read,
 * and RLS applies exactly as it does in the browser.
 *
 * Must be created per request. Next.js caches modules across requests, so a
 * shared client would leak one user's session into another's.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server components cannot set cookies. This is expected and safe:
            // middleware refreshes the session on every request, so the write
            // that matters already happened before this component rendered.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user, or null.
 *
 * Deliberately `getUser()` and not `getSession()`. getSession reads the JWT
 * straight from the cookie without asking Supabase whether it is still valid,
 * so on the server it will happily report a user for a forged or revoked
 * token. getUser revalidates against the auth server. Anything making an
 * access decision must use this.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
