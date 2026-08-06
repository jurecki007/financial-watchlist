import type { NextConfig } from "next";

/**
 * Baseline security headers.
 *
 * HSTS is now set here rather than left to Vercel. Vercel's default carries a
 * two-year max-age but no `includeSubDomains` and no `preload`, and those two
 * directives are the ones that need an owner's decision rather than a
 * platform default.
 *
 * Content-Security-Policy is deliberately ABSENT. A useful CSP for Next.js
 * needs per-request nonces threaded through the App Router, and a guessed-at
 * policy either breaks hydration or is so permissive it certifies nothing.
 * It gets built in Phase 3 alongside the first real UI, against pages that
 * exist — see the Phase 6 fault-injection item in ROADMAP.md.
 */
const securityHeaders = [
  // Two years, covering this host and anything beneath it.
  //
  // Scope is narrower than it looks: a header served from
  // financial-demo.nyxiontech.com binds that host and *.financial-demo...,
  // NOT sibling subdomains of nyxiontech.com. Those are governed by whatever
  // they serve themselves, so this cannot break an unrelated subdomain.
  //
  // `preload` is a request to be baked into browser binaries, and it does
  // nothing on its own — the host must additionally be submitted and accepted
  // at hstspreload.org. Until that submission happens this directive is inert.
  // It is stated here because removal from the list takes months once granted,
  // so the intent belongs in version control where it can be argued with,
  // rather than being flipped on in a dashboard.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
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
    return [
      { source: "/:path*", headers: securityHeaders },
      // The rendered emails under /mockups/ are framed by /about/project so a
      // reviewer can see every message without one being sent. The blanket
      // DENY above stopped that — the frames were silently blank, and only
      // loading the page in a browser showed it.
      //
      // Narrowed to SAMEORIGIN for these paths only, and only these: the
      // reason DENY exists is that framing an authenticated watchlist is a
      // clickjacking target, and none of that applies to four static
      // documents with no session, no forms and no state. Every other route,
      // including the whole app, keeps DENY.
      //
      // frame-ancestors is the modern control and XFO the legacy one; both are
      // set so the pair cannot disagree in a browser that honours only one.
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
