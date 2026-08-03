"use client";

import { useActionState } from "react";
import { createAlert, deleteAlert, type AlertState } from "@/app/company/[ticker]/alert-actions";

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
 * The threshold input is `inputMode="decimal"` rather than `type="number"`:
 * number inputs silently discard values on some locales that use a comma
 * decimal separator, and a price quietly becoming a different price is a
 * uniquely bad failure for this feature. Parsing happens server-side.
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
  const [state, formAction, pending] = useActionState<AlertState, FormData>(
    createAlert,
    undefined,
  );

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="ticker" value={ticker} />

        <label className="block">
          <span className="mb-2 block text-xs text-[var(--dim)]">
            Alert me when price is
          </span>
          <select
            name="condition"
            defaultValue="above"
            className="h-10 border border-[var(--rule-strong)] bg-[var(--raised)] px-3 text-sm focus:border-[var(--gold)] focus:outline-none"
          >
            <option value="above">above</option>
            <option value="below">below</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs text-[var(--dim)]">Price</span>
          <input
            name="threshold"
            inputMode="decimal"
            required
            placeholder={currentPrice ? currentPrice.toFixed(2) : "0.00"}
            className="h-10 w-32 border border-[var(--rule-strong)] bg-[var(--raised)] px-3 font-mono text-sm tabular-nums focus:border-[var(--gold)] focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="h-10 bg-[var(--gold)] px-4 text-sm font-medium text-[var(--ground)] transition-opacity hover:opacity-90 disabled:opacity-55"
        >
          {pending ? "Saving…" : "Set alert"}
        </button>
      </form>

      {state?.error && (
        <p
          role="alert"
          className="mt-3 border-l-2 border-[var(--down)] bg-[var(--raised)] px-3 py-2 text-sm"
        >
          {state.error}
        </p>
      )}

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
                  <span className="ml-3 font-sans text-xs text-[var(--faint)]">
                    watching
                  </span>
                )}
              </span>
              <form action={deleteAlert}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="ticker" value={ticker} />
                <button
                  type="submit"
                  aria-label="Delete this alert"
                  className="px-2 py-1 text-sm text-[var(--faint)] transition-colors hover:text-[var(--down)]"
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
