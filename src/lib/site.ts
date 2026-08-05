/**
 * The production origin. `metadataBase` in the root layout resolves every
 * relative metadata URL — canonical, Open Graph, Twitter — against this.
 *
 * Hardcoded rather than read from `VERCEL_URL`, and that is the point. A preview
 * deployment gets its own throwaway hostname; resolving canonicals against it
 * would declare each preview the authoritative copy of every page, which is
 * exactly the duplicate-content problem canonical tags exist to solve. Previews
 * should point at production.
 *
 * One constant rather than an env var: the domain is already committed in
 * `README.md` and `ROADMAP.md`, and an unset variable in production would fail
 * silently and wrongly — `metadataBase` would fall back to localhost.
 */
export const SITE_URL = new URL("https://financial-demo.nyxiontech.com");
