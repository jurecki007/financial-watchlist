import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

/**
 * Supabase client for server components, route handlers and server actions.
 * Still the publishable key — this holds the *user's* session, not admin
 * rights, so RLS applies as it does in the browser.
 *
 * Per request: Next caches modules, so a shared client would leak one user's
 * session into another's.
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
            // Server components cannot set cookies; middleware already wrote
            // the refreshed session before this rendered.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user, or null. React `cache()` so components in one render
 * share a single round-trip rather than each paying ~150ms.
 *
 * `getUser()`, never `getSession()`: the latter reads the JWT from the cookie
 * without validating it, and will report a user for a forged or revoked token.
 */
/**
 * The identity middleware already validated, read from the header it forwards.
 * Safe because middleware sets these unconditionally, including to empty, so a
 * forged header is always overwritten — a cache of its decision, not a source.
 */
export const getSessionUser = cache(async () => {
  const h = await headers();
  const id = h.get("x-user-id");
  if (!id) return null;
  return { id, email: h.get("x-user-email") || undefined };
});

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
