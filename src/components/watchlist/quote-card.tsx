"use client";

import Link from "next/link";
import { removeTicker } from "@/app/dashboard/actions";
import { useWatchlist } from "@/components/watchlist/optimistic";
import { NumberSkeleton, Skeleton } from "@/components/ui/states";
import { positionInRange, type Quote } from "@/lib/market-data";

/**
 * A watchlist card answers "should I look closer?", which a price and a
 * percentage cannot. It spends its space on where the price sits in the year
 * rather than on chrome, so there is no border — the grid gap is separation.
 *
 * The card and its skeleton share one Frame so they cannot disagree on size.
 */

/**
 * Where the price sits between its 52-week extremes — what turns 309 into a
 * judgement. Every field ships in the quote already, so it costs no request.
 *
 * A marker rather than a filled bar, because this is a position, not a quantity.
 */
function YearRange({ quote }: { quote: Quote }) {
  const pos = positionInRange(quote.price, quote.yearLow, quote.yearHigh);
  if (pos === undefined) return null;

  return (
    <div className="mt-3.5">
      <div className="relative h-px w-full bg-[var(--rule-strong)]">
        <span
          aria-hidden
          className="absolute top-1/2 size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--gold)]"
          style={{ left: `${pos * 100}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] tabular-nums text-[var(--faint)]">
        <span>{quote.yearLow?.toFixed(0)}</span>
        {/* The marker is positional and invisible to a screen reader, so the
            same fact is stated in words. */}
        <span className="sr-only">
          {`${(pos * 100).toFixed(0)} percent of the 52-week range`}
        </span>
        <span aria-hidden>52w</span>
        <span>{quote.yearHigh?.toFixed(0)}</span>
      </div>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  // No border. The grid gap already separates cards; a box around each one was
  // chrome doing work the spacing had already done.
  return (
    <div className="group relative flex min-h-[9.5rem] flex-col justify-between bg-[var(--raised)] px-4 py-3.5 transition-colors hover:bg-[var(--rule)]">
      {children}
    </div>
  );
}

export function QuoteCardSkeleton({ ticker }: { ticker?: string }) {
  return (
    <Frame>
      <div className="flex items-start justify-between gap-3">
        {ticker ? (
          <span className="font-mono text-sm tracking-wide">{ticker}</span>
        ) : (
          <Skeleton className="h-[0.9rem] w-14" />
        )}
      </div>
      <div className="mt-4">
        <NumberSkeleton digits={8} className="h-[1.6rem]" />
        <div className="mt-2">
          <NumberSkeleton digits={7} />
        </div>
        <Skeleton className="mt-4 h-px w-full" />
      </div>
    </Frame>
  );
}

export function QuoteCard({
  ticker,
  companyName,
  quote,
  pending,
}: {
  ticker: string;
  companyName?: string | null;
  quote?: Quote;
  pending?: boolean;
}) {
  const up = (quote?.changePercent ?? 0) >= 0;
  const { optimisticRemove } = useWatchlist();

  return (
    <Frame>
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/company/${encodeURIComponent(ticker)}`}
          // Stretched link: the whole card is the target, so the pointer does
          // not have to find four characters of ticker.
          className="min-w-0 before:absolute before:inset-0 before:content-['']"
        >
          <p className="font-mono text-sm tracking-wide">{ticker}</p>
          {companyName && (
            <p className="mt-0.5 truncate text-xs text-[var(--dim)]">
              {companyName}
            </p>
          )}
        </Link>

        {/* Sits above the stretched link so it stays clickable. Revealed on
            hover and focus but never removed from the tree: a control that
            only exists on hover does not exist on a touchscreen or to a
            keyboard, so this is opacity, not display. */}
        <form
          action={async (formData) => {
            optimisticRemove(ticker);
            await removeTicker(formData);
          }}
          className="relative z-10"
        >
          <input type="hidden" name="ticker" value={ticker} />
          <button
            type="submit"
            aria-label={`Remove ${ticker} from your watchlist`}
            className="-mt-1 -mr-1 px-2 py-1 text-sm text-[var(--faint)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--down)] focus-visible:opacity-100"
          >
            ×
          </button>
        </form>
      </div>

      <div className="mt-4">
        {quote ? (
          <>
            <p className="font-mono text-[1.5rem] leading-none tabular-nums">
              {quote.price.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              {/* Direction carries a glyph and a sign as well as colour, so it
                  survives colour being unavailable. */}
              <span
                className={`font-mono text-xs tabular-nums ${
                  up ? "text-[var(--up)]" : "text-[var(--down)]"
                }`}
              >
                {up ? "▲" : "▼"} {up ? "+" : ""}
                {quote.changePercent.toFixed(2)}%
              </span>
              <span className="font-mono text-xs tabular-nums text-[var(--faint)]">
                {up ? "+" : ""}
                {quote.change.toFixed(2)}
              </span>
              {/* A flat price reads as a broken feed unless the market is
                  known to be shut. */}
              {quote.marketOpen === false && (
                <span className="font-mono text-[10px] text-[var(--faint)]">
                  closed
                </span>
              )}
            </div>
            <YearRange quote={quote} />
          </>
        ) : pending ? (
          // Added a moment ago, no quote yet. Never invent a number: guessing a
          // price in a product about prices is the one lie this UI must not tell.
          <div>
            <NumberSkeleton digits={8} className="h-[1.6rem]" />
            <p className="mt-2 font-mono text-[11px] text-[var(--faint)]">
              fetching price…
            </p>
          </div>
        ) : (
          // Quote missing but the row exists: the provider skipped this symbol
          // in a batch. Say so on the card rather than failing the whole grid.
          <p className="text-xs leading-relaxed text-[var(--dim)]">
            No price available right now.
          </p>
        )}
      </div>
    </Frame>
  );
}
