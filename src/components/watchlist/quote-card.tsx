import Link from "next/link";
import { removeTicker } from "@/app/dashboard/actions";
import { NumberSkeleton, Skeleton } from "@/components/ui/states";
import type { Quote } from "@/lib/market-data";

/**
 * One watched company.
 *
 * The card and its skeleton are built from the same layout so they cannot
 * disagree on size. When the loaded card gains a row, the skeleton gains one
 * too — the alternative is hand-sized placeholders that drift and make the
 * page lurch as data lands.
 */

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[7.5rem] flex-col justify-between border border-[var(--rule)] bg-[var(--raised)] px-4 py-3.5 transition-colors hover:border-[var(--rule-strong)]">
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
        <Skeleton className="h-[0.9rem] w-10" />
      </div>
      <div className="mt-4">
        <NumberSkeleton digits={8} className="h-[1.6rem]" />
        <div className="mt-2">
          <NumberSkeleton digits={7} />
        </div>
      </div>
    </Frame>
  );
}

export function QuoteCard({
  ticker,
  companyName,
  quote,
}: {
  ticker: string;
  companyName?: string | null;
  quote?: Quote;
}) {
  const up = (quote?.changePercent ?? 0) >= 0;

  return (
    <Frame>
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/company/${encodeURIComponent(ticker)}`}
          className="min-w-0 transition-colors hover:text-[var(--gold)]"
        >
          <p className="font-mono text-sm tracking-wide">{ticker}</p>
          {companyName && (
            <p className="mt-0.5 truncate text-xs text-[var(--dim)]">
              {companyName}
            </p>
          )}
        </Link>
        {/* Remove is a form, not a link: it mutates, so it must not be a GET
            that a prefetcher could fire. */}
        <form action={removeTicker}>
          <input type="hidden" name="ticker" value={ticker} />
          <button
            type="submit"
            aria-label={`Remove ${ticker} from your watchlist`}
            className="-mt-1 -mr-1 px-2 py-1 text-sm text-[var(--faint)] transition-colors hover:text-[var(--down)]"
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
            {/* Direction carries a glyph and a sign as well as colour, so it
                survives colour being unavailable. The absolute move sits
                beside the percentage: "+4.9%" alone hides whether that is
                three dollars or thirty. */}
            <div
              className={`mt-2 font-mono text-xs tabular-nums ${
                up ? "text-[var(--up)]" : "text-[var(--down)]"
              }`}
            >
              {up ? "▲" : "▼"} {up ? "+" : ""}
              {quote.changePercent.toFixed(2)}%
              <span className="ml-2 text-[var(--faint)]">
                {up ? "+" : ""}
                {quote.change.toFixed(2)}
              </span>
            </div>
          </>
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
