// Relative with an explicit extension, matching src/lib/market-data/. That is
// what lets `node --test` run this module directly, without a bundler to
// resolve the "@/" alias.
import { SITE_URL } from "./site.ts";

/**
 * JSON-LD for the landing page.
 *
 * Two entities, joined by @id rather than nested, so each can be referenced
 * again from another page later without being restated.
 *
 * What is deliberately NOT here:
 *
 * - **No SearchAction / sitelinks searchbox.** The ticker search lives behind
 *   auth on /dashboard, so a crawler cannot reach it. Declaring a search
 *   endpoint Google is unable to exercise is an unverifiable claim, and Google
 *   retired the sitelinks-searchbox rich result in November 2024 regardless.
 * - **No FAQPage.** Google retired FAQ rich results for all sites on
 *   2026-05-07. It buys nothing now.
 * - **No Organization.** There is no company here — this is one person's demo,
 *   and an Organization would assert a legal entity that does not exist.
 * - **No real name.** The site publishes none anywhere else, and the GitHub
 *   account the footer already links is the only identity it does assert.
 *   Structured data should not be the one place the project discloses more
 *   about its author than the page it describes.
 */
const GITHUB_PROFILE = "https://github.com/jurecki007";

const AUTHOR_ID = new URL("/#author", SITE_URL).href;
const WEBSITE_ID = new URL("/#website", SITE_URL).href;

export function landingPageGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: SITE_URL.href,
        name: "Financial Watchlist",
        description:
          "Prices, charts and the news that moves them, for the companies you actually follow.",
        // Matches <html lang="en">. A mismatch between the two is a signal
        // Google treats as a quality problem, so they are worth keeping in step.
        inLanguage: "en",
        creator: { "@id": AUTHOR_ID },
      },
      {
        "@type": "Person",
        "@id": AUTHOR_ID,
        name: "jurecki007",
        // sameAs, not url: this is the reference page that identifies the
        // person, which is exactly what sameAs is for.
        sameAs: [GITHUB_PROFILE],
      },
    ],
  };
}

/**
 * Serialise for embedding in a <script type="application/ld+json">.
 *
 * `<` is escaped to its unicode form so a literal "</script>" appearing in any
 * future string value cannot terminate the block early. Every value here is a
 * static constant today, so this guards against a later edit rather than
 * against present input — which is when this kind of bug actually lands.
 */
export function serialiseJsonLd(graph: unknown) {
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
