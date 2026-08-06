/**
 * Production origin, resolved against by `metadataBase` for every relative
 * metadata URL. Hardcoded rather than read from `VERCEL_URL` so preview
 * deployments canonicalise to production instead of declaring themselves
 * authoritative.
 */
export const SITE_URL = new URL("https://financial-demo.nyxiontech.com");
