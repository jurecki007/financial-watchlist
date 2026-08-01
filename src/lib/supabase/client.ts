import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for client components.
 *
 * Only ever holds the publishable key, which is designed to reach the browser.
 * Everything it can do, a user can do — RLS is the enforcement boundary, not
 * this module. See supabase/migrations for the policies that do the work.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
