import { getUser } from "@/lib/supabase/server";

/**
 * Placeholder dashboard. Exists so the middleware gate has something real to
 * protect and so the session round-trip is verifiable end to end. The actual
 * watchlist dashboard is Phase 5; the visual system it will inherit is Phase 3.
 *
 * Note there is no auth check in this component. That is the point of rule 7 —
 * middleware guarantees a user is present before this renders, so pages do not
 * each re-implement a check they can forget.
 */
export default async function DashboardPage() {
  const user = await getUser();

  return (
    <main className="roadmap min-h-screen px-6 py-20">
      <div className="mx-auto max-w-[46rem]">
        <p className="font-mono text-xs tracking-[0.18em] text-[var(--dim)] uppercase">
          Dashboard
        </p>
        <h1 className="mt-5 text-3xl font-medium tracking-tight">
          Signed in
        </h1>
        <p className="mt-4 text-[0.95rem] leading-relaxed text-[var(--dim)]">
          Session resolved server-side as{" "}
          <span className="font-mono text-[var(--gold)]">{user?.email}</span>.
          The watchlist itself arrives in Phase 5.
        </p>
      </div>
    </main>
  );
}
