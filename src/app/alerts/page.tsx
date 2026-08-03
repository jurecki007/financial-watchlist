import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteAlert } from "@/app/company/[ticker]/alert-actions";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/ui/footer";
import { Container } from "@/components/ui/shell";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Alerts — Financial Watchlist" };

type Row = {
  id: string;
  ticker: string;
  condition: "above" | "below";
  threshold: number;
  triggered_at: string | null;
  active: boolean;
};

/**
 * Every alert in one place.
 *
 * Alerts are created on a company page, which is the right place to set one —
 * but it meant the only way to see what you had armed was to visit each
 * company in turn and remember. That is the Memory Bridge: state the user has
 * to reconstruct by navigating.
 *
 * Waiting and sent are separated rather than sorted together. They answer
 * different questions — "what am I still watching for" versus "what have I
 * been told" — and mixing them makes the first hard to read.
 */
function AlertRow({ row }: { row: Row }) {
  const sent = Boolean(row.triggered_at);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[var(--rule)] py-3.5">
      <div className="flex items-baseline gap-4">
        <Link
          href={`/company/${encodeURIComponent(row.ticker)}`}
          className="w-16 font-mono text-sm transition-colors hover:text-[var(--gold)]"
        >
          {row.ticker}
        </Link>
        <span className="text-sm text-[var(--dim)]">
          when price is{" "}
          <span className="font-mono tabular-nums text-[var(--fg)]">
            {row.condition}{" "}
            {row.threshold.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        {sent && (
          // Gold, not green — green means price direction in this product.
          <span className="font-mono text-[11px] text-[var(--gold)]">
            emailed {new Date(row.triggered_at!).toLocaleDateString("en-GB")}
          </span>
        )}
        <form action={deleteAlert}>
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="ticker" value={row.ticker} />
          <button
            type="submit"
            aria-label={`Delete the ${row.ticker} alert`}
            className="px-2 py-1 text-sm text-[var(--faint)] transition-colors hover:text-[var(--down)]"
          >
            ×
          </button>
        </form>
      </div>
    </li>
  );
}

export default async function AlertsPage() {
  const supabase = await createClient();
  // No user_id filter — RLS scopes this to the signed-in user.
  const { data } = await supabase
    .from("price_alerts")
    .select("id, ticker, condition, threshold, triggered_at, active")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Row[];
  const waiting = rows.filter((r) => !r.triggered_at);
  const sent = rows.filter((r) => r.triggered_at);
  // Section headings distinguish two groups. With only one group there is
  // nothing to distinguish, and "Watching" then merely repeats the count
  // already in the subhead.
  const bothGroups = waiting.length > 0 && sent.length > 0;

  return (
    <>
      <Nav />
      <main className="min-h-screen py-10">
        <Container>
          <header>
            <h1 className="text-2xl font-medium tracking-tight">Alerts</h1>
            <p className="mt-1.5 text-sm text-[var(--dim)]">
              {waiting.length
                ? `${waiting.length} watching for a price`
                : "Set a price and we'll email you when it's crossed"}
            </p>
          </header>

          <div className="mt-9 space-y-12">
            {rows.length === 0 ? (
              <EmptyState
                title="No alerts set"
                body="Open a company and set a price. We'll email you when it crosses, whether or not you have this open."
                action={
                  <Link
                    href="/dashboard"
                    className="flex h-10 items-center bg-[var(--gold)] px-4 text-sm font-medium text-[var(--ground)] transition-opacity hover:opacity-90"
                  >
                    Go to watchlist
                  </Link>
                }
              />
            ) : (
              <>
                {waiting.length > 0 && (
                  <section>
                    {bothGroups && (
                      <h2 className="mb-3 font-mono text-xs tracking-[0.18em] text-[var(--dim)] uppercase">
                        Watching
                      </h2>
                    )}
                    <ul>
                      {waiting.map((r) => (
                        <AlertRow key={r.id} row={r} />
                      ))}
                    </ul>
                  </section>
                )}

                {sent.length > 0 && (
                  <section>
                    {bothGroups && (
                      <h2 className="mb-3 font-mono text-xs tracking-[0.18em] text-[var(--dim)] uppercase">
                        Already sent
                      </h2>
                    )}
                    <p className="mb-3 text-sm text-[var(--dim)]">
                      An alert fires once. Set a new one from the company page
                      to watch the same price again.
                    </p>
                    <ul>
                      {sent.map((r) => (
                        <AlertRow key={r.id} row={r} />
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
