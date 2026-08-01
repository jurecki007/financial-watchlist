/**
 * Phase 1 holding page.
 *
 * Deliberately minimal: its only job is to prove the Cloudflare → Vercel
 * pipeline serves this app end to end. The real landing page — market-native
 * dark, self-drawing gold candlestick hero — is Phase 3, and building it
 * before the deploy path is verified would mean debugging two things at once.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Financial Watchlist
      </h1>
      <p className="max-w-prose text-center text-sm opacity-70">
        Track companies, watch prices and charts, read the news that moves them.
      </p>
      <p className="font-mono text-xs opacity-50">Phase 1 — scaffold</p>
    </main>
  );
}
