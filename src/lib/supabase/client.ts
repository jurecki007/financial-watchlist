import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for client components. Only ever the publishable key: RLS is
 * the enforcement boundary, not this module.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
