import type { NextConfig } from "next";

/**
 * Baseline security headers.
 *
 * No Content-Security-Policy: a useful one for the App Router needs
 * per-request nonces, and a guessed policy either breaks hydration or is
 * permissive enough to certify nothing.
 */
const securityHeaders = [
  // `preload` is inert until the host is submitted at hstspreload.org, but it
  // is stated here because removal takes months once granted.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Clickjacking a watchlist mutation is a real attack; nothing here needs framing.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // A full-URL referrer would leak /company/AAPL — and so the watchlist — to
  // any publisher we link out to.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // /about/project frames the rendered emails, which the blanket DENY
      // blocked. Narrowed here only: these are static documents with no
      // session, forms or state. Both the modern and legacy controls are set
      // so they cannot disagree.
      {
        source: "/mockups/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
