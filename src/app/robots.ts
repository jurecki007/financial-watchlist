import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * No AI-crawler blocks, deliberately.
 *
 * GPTBot, ClaudeBot, Google-Extended and friends are all allowed. This is a
 * portfolio piece whose whole purpose is to be read; being answerable when
 * someone asks an assistant about it is upside, not leakage. Nothing here is
 * private — the private surface is behind auth, where robots.txt is not the
 * control doing the work.
 *
 * Worth stating because blocking `Google-Extended` is commonly believed to
 * protect search ranking: it does not. It governs Gemini training only.
 * Googlebot is what indexes, and it is allowed.
 *
 * The two Disallow entries are not content:
 *   /api/  — quotes and search; JSON endpoints that 401 or burn provider
 *            credits when fetched anonymously. Nothing to index, real cost to
 *            crawl.
 *   /auth/ — the OAuth callback. It exists to exchange a one-time code, and a
 *            crawler hitting it can only ever produce an error.
 *   /mockups/ — the rendered emails framed on /about/project. They are real
 *            documents rather than pages: no canonical, no nav, and titles like
 *            "Confirm your email" that would compete with the app's own routes
 *            in a result list. Disallow is the only lever here, because the
 *            files are byte-faithful copies of what gets sent and adding a
 *            noindex meta to them would make them stop being that.
 *
 * The auth-gated app routes (/dashboard, /news, /alerts, /company/*) are left
 * crawlable on purpose. They 307 to /login, which carries its own noindex, so
 * they are already handled by a directive Google must fetch the page to see —
 * blocking them here would hide that directive rather than reinforce it.
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
