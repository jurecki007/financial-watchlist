import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * AI crawlers are allowed on purpose — this is a portfolio piece, and nothing
 * public here is private.
 *
 * The Disallow entries are not content: /api/ costs provider credits to crawl,
 * /auth/ only exchanges one-time codes, and /mockups/ holds the rendered
 * emails, which are documents rather than pages. The gated app routes stay
 * crawlable because they redirect to /login, which carries its own noindex —
 * blocking them here would hide that directive instead of reinforcing it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/mockups/"],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
  };
}
