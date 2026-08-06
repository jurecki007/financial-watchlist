// Relative with an explicit extension so `node --test` can run this module
// without a bundler to resolve the "@/" alias.
import { SITE_URL } from "./site.ts";

/**
 * JSON-LD for the landing page. Two entities joined by @id rather than nested,
 * so either can be referenced from another page later.
 *
 * No SearchAction (the search is behind auth, so a crawler cannot exercise it),
 * no FAQPage (Google retired the rich result), no Organization (there is no
 * company here).
 */
const GITHUB_PROFILE = "https://github.com/jurecki007";
const AUTHOR_NAME = "Maciej Sacewicz";

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
        // Must match <html lang>; a mismatch reads as a quality problem.
        inLanguage: "en",
        creator: { "@id": AUTHOR_ID },
      },
      {
        "@type": "Person",
        "@id": AUTHOR_ID,
        name: AUTHOR_NAME,
        // `url` is the entity's home on this site; `sameAs` is the same person
        // elsewhere.
        url: new URL("/about/author", SITE_URL).href,
        sameAs: [GITHUB_PROFILE],
      },
    ],
  };
}

/**
 * Escapes `<` so a future string value containing "</script>" cannot terminate
 * the JSON-LD block early. Every value is static today; this guards the edit
 * that changes that.
 */
export function serialiseJsonLd(graph: unknown) {
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
