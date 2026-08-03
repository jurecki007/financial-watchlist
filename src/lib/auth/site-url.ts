import { headers } from "next/headers";

/**
 * The absolute origin to hand to Supabase as an OAuth redirect target.
 *
 * Deriving this from the `origin` header alone is fragile: the header is
 * absent on some server-side navigations, and an empty origin produces a
 * relative redirect_to that Supabase cannot match against its allow-list —
 * which makes it fall back to the project's Site URL and bounce the user to
 * whatever that is. That is exactly the localhost symptom, and it fails
 * silently.
 *
 * Order: explicit configuration, then the forwarded host Vercel sets, then
 * origin, then localhost for local dev.
 */
export async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const h = await headers();

  const forwardedHost = h.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = h.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }

  const origin = h.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const host = h.get("host");
  if (host) {
    const proto = host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https";
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}
