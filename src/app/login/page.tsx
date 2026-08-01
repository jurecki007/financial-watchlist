/**
 * Placeholder sign-in route. Present so the middleware has a real redirect
 * target and so the `next` round-trip can be verified. The designed auth
 * experience — email/password, Google OAuth, the three async states — is the
 * next piece of Phase 2 and gets built against the Phase 3 design tokens.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="roadmap flex min-h-screen flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-[26rem]">
        <p className="font-mono text-xs tracking-[0.18em] text-[var(--dim)] uppercase">
          Financial Watchlist
        </p>
        <h1 className="mt-5 text-3xl font-medium tracking-tight">Sign in</h1>
        <p className="mt-4 text-[0.95rem] leading-relaxed text-[var(--dim)]">
          {next
            ? "You need an account to view that page."
            : "Email and Google sign-in arrive with the next commit."}
        </p>
        {next && (
          <p className="mt-6 font-mono text-xs text-[var(--dim)]">
            return to <span className="text-[var(--gold)]">{next}</span> after
            signing in
          </p>
        )}
      </div>
    </main>
  );
}
