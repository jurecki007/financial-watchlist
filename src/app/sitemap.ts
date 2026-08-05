import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Two URLs, because two URLs are indexable.
 *
 * /login and /signup are excluded: they carry `noindex`, and listing a noindex
 * URL in a sitemap asks Google to index something we have simultaneously told
 * it not to. The gated routes are excluded for the same reason one step
 * removed — they redirect to a noindex page.
 *
 * On a site this small the sitemap is not a discovery mechanism; both URLs are
 * one click from the root. Its value is as an assertion of intent that Search
 * Console reports coverage against, which turns "is the roadmap indexed?" into
 * a number we can read rather than a thing we assume.
 *
 * No `lastModified`, `changeFrequency` or `priority`, all deliberately:
 *
 * - `lastModified` has no trustworthy source here. Vercel checks the repo out
 *   fresh per build, so the mtime of ROADMAP.md is the build time, not the time
 *   anyone ticked a box. Emitting it would claim the roadmap changed on every
 *   unrelated deploy; a lastmod that is always "just now" is one Google learns
 *   to disregard, which is worse than none.
 * - `changeFrequency` and `priority` are documented as ignored by Google.
 *   Including them would be decoration.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: new URL("/", SITE_URL).href },
    { url: new URL("/about/project", SITE_URL).href },
    { url: new URL("/about/author", SITE_URL).href },
    { url: new URL("/roadmap", SITE_URL).href },
  ];
}
