"use client";

import { deleteAlert } from "@/app/company/[ticker]/alert-actions";
import { AlertForm } from "@/components/alerts/alert-form";

export type AlertRow = {
  id: string;
  condition: "above" | "below";
  threshold: number;
  triggered_at: string | null;
  active: boolean;
};

/**
 * Create and manage price alerts for one company.
 *
 * The form itself is shared with /alerts — see components/alerts/alert-form.
 * The only difference between the two surfaces is whether the ticker is
 * already known, and that is a prop rather than a second implementation.
 */
export function AlertPanel({
  ticker,
  alerts,
  currentPrice,
}: {
  ticker: string;
  alerts: AlertRow[];
  currentPrice?: number;
}) {
  return (
    <div>
      <AlertForm ticker={ticker} currentPrice={currentPrice} />

      {alerts.length === 0 ? (
        <p className="mt-5 text-sm text-[var(--dim)]">
          No alerts set. We&rsquo;ll email you when one triggers.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-4 border-t border-[var(--rule)] pt-3"
            >
              <span className="font-mono text-sm tabular-nums">
                {a.condition}{" "}
                {a.threshold.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
                {a.triggered_at ? (
                  // Gold, not green — green means price direction here.
                  <span className="ml-3 font-sans text-xs text-[var(--gold)]">
                    sent {new Date(a.triggered_at).toLocaleDateString("en-GB")}
                  </span>
                ) : (
                  // --faint measured 3.9:1 here, under the 4.5:1 floor at this
                  // size. --dim clears it without promoting the word.
                  <span className="ml-3 font-sans text-xs text-[var(--dim)]">
                    watching
                  </span>
                )}
              </span>
              <form action={deleteAlert}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="ticker" value={ticker} />
                {/* Was a 23x28 target at 3.9:1 — under both the 24px minimum
                    and the contrast floor, on a destructive control. The mark
                    stays the same size; the hit area and contrast do not. */}
                <button
                  type="submit"
                  aria-label="Delete this alert"
                  className="flex size-8 items-center justify-center text-sm text-[var(--dim)] transition-colors hover:text-[var(--down)]"
                >
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
