import type { NextConfig } from "next";

/**
 * Baseline security headers.
 *
 * Vercel already sends HSTS, so that is not repeated here. These four cover the
 * cheap, unambiguous wins that need no knowledge of the page's contents.
 *
 * Content-Security-Policy is deliberately ABSENT. A useful CSP for Next.js
 * needs per-request nonces threaded through the App Router, and a guessed-at
 * policy either breaks hydration or is so permissive it certifies nothing.
 * It gets built in Phase 3 alongside the first real UI, against pages that
 * exist — see the Phase 6 fault-injection item in ROADMAP.md.
 */
const securityHeaders = [
  // This app renders account-specific financial data; there is no legitimate
  // reason to embed it in a frame, and clickjacking a watchlist mutation is
  // a real (if unglamorous) attack.
  { key: "X-Frame-Options", value: "DENY" },
  // Stop the browser second-guessing our Content-Type — MIME sniffing turns a
  // user-supplied file into an executable script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Tickers a user watches are private. Full-URL referrers would leak a route
  // like /company/AAPL to any third party we link out to, including news
  // publishers, which discloses watchlist contents.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here needs hardware access; deny by default rather than
  // enumerating later.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
