import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteAlert } from "@/app/company/[ticker]/alert-actions";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/ui/footer";
import { Container } from "@/components/ui/shell";
import { EmptyState } from "@/components/ui/states";
import { AlertForm } from "@/components/alerts/alert-form";

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
 * Every alert in one place — and now the place to set one.
 *
 * This page used to be read-only: it listed alerts and told you to go to a
 * company page to make one. That is a dead end on the screen whose entire
 * subject is alerts. Someone arriving here wants to arm a price, and sending
 * them to the watchlist to pick a company to then find the form is three
 * navigations to reach a control that fits above the list.
 *
 * The company page keeps its own form. Neither is a copy — both render
 * components/alerts/alert-form, which differs only in whether the ticker is
 * already known.
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
          //
          // "triggered", not "emailed". `triggered_at` records that the
          // evaluator claimed this alert, which happens deliberately BEFORE the
          // send so a crash cannot deliver the same crossing twice. The send
          // can still fail afterwards — and did, silently, for three
          // consecutive alerts when the Resend sender domain stopped being
          // verified, while this label went on asserting mail had gone out.
          // The row genuinely knows the threshold was crossed and when; it does
          // not know an email arrived, so it no longer says so.
          <span className="font-mono text-[11px] text-[var(--gold)]">
            triggered {new Date(row.triggered_at!).toLocaleDateString("en-GB")}
          </span>
        )}
        <form action={deleteAlert}>
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="ticker" value={row.ticker} />
          {/* size-8 hit area at --dim: the previous 23x28 at --faint missed
              both the 24px target minimum and the 4.5:1 contrast floor, on a
              control that destroys data. */}
          <button
            type="submit"
            aria-label={`Delete the ${row.ticker} alert`}
            className="flex size-8 items-center justify-center text-sm text-[var(--dim)] transition-colors hover:text-[var(--down)]"
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
  // No user_id filter on either query — RLS scopes both to the signed-in user.
  const [{ data }, { data: watchlist }] = await Promise.all([
    supabase
      .from("price_alerts")
      .select("id, ticker, condition, threshold, triggered_at, active")
      .order("created_at", { ascending: false }),
    // The form offers the watchlist rather than a free-text ticker box: an
    // alert on a company you do not follow is a dead letter, and a typo'd
    // symbol would validate fine here and then simply never fire.
    supabase
      .from("watchlist_items")
      .select("ticker, company_name")
      .order("ticker"),
  ]);

  const rows = (data ?? []) as Row[];
  const choices = (watchlist ?? []).map((w) => ({
    ticker: w.ticker as string,
    companyName: w.company_name as string | null,
  }));
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

          {/* The form leads. It is the action this page exists to enable, and
              putting it under a list that can run to dozens of rows would bury
              it below the fold on exactly the accounts that use alerts most. */}
          {choices.length > 0 && (
            <div className="mt-8 border-t border-[var(--rule)] pt-6">
              <AlertForm tickers={choices} />
            </div>
          )}

          <div className="mt-9 space-y-12">
            {rows.length === 0 ? (
              <EmptyState
                title="No alerts set"
                // The copy has to match what is actually on screen. With a
                // watchlist the form is right above this, so pointing at a
                // company page would be describing a different product.
                body={
                  choices.length > 0
                    ? "Pick a company above and set a price. We'll email you when it crosses, whether or not you have this open."
                    : "Add a company to your watchlist first, then set a price here. We'll email you when it crosses."
                }
                action={
                  choices.length === 0 ? (
                    <Link
                      href="/dashboard"
                      className="flex h-11 items-center bg-[var(--gold)] px-5 text-sm font-medium text-[var(--ground)] transition-opacity hover:opacity-90"
                    >
                      Go to watchlist
                    </Link>
                  ) : undefined
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
                      An alert fires once. Set a new one above to watch the same
                      price again.
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
