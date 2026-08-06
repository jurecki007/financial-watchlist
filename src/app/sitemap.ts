import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Only indexable URLs. /login and /signup carry `noindex`, and the gated
 * routes redirect to them.
 *
 * No `lastModified`: Vercel checks the repo out fresh per build, so any mtime
 * would report the build time and claim every page changed on every deploy.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: new URL("/", SITE_URL).href },
    { url: new URL("/about/project", SITE_URL).href },
    { url: new URL("/about/author", SITE_URL).href },
    { url: new URL("/roadmap", SITE_URL).href },
  ];
}
