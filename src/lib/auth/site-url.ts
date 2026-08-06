import { headers } from "next/headers";

/**
 * The absolute origin handed to Supabase as an OAuth redirect target.
 *
 * The `origin` header alone is not enough: it is absent on some server-side
 * navigations, and a relative redirect_to fails Supabase's allow-list, falling
 * back to the project's Site URL — the localhost bounce, and it fails silently.
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
