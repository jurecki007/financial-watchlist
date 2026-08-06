"use client";

import { useActionState, useId } from "react";
import { createAlert, type AlertState } from "@/app/company/[ticker]/alert-actions";

export type TickerChoice = { ticker: string; companyName?: string | null };

/**
 * The one place an alert gets created — /alerts and the company page differ
 * only in whether the ticker is already known, and two copies would drift.
 *
 * `inputMode="decimal"` rather than `type="number"`: number inputs silently
 * discard values on comma-decimal locales, and a price quietly becoming a
 * different price is a uniquely bad failure here.
 */

/**
 * Shared control chrome. `appearance-none` matters on the <select>: otherwise
 * the browser draws its own arrow in a system colour, grey-on-grey when dark.
 */
const FIELD =
  "h-11 w-full border border-[var(--field-border)] bg-[var(--raised)] px-3 text-sm " +
  "focus:border-[var(--gold)] focus:outline-none";

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-xs tracking-wide text-[var(--dim)]"
    >
      {children}
    </label>
  );
}

/** Drawn, not a glyph, and sized to the text rather than to the control. */
function Chevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute right-3 bottom-[0.95rem] size-3 text-[var(--dim)]"
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}

export function AlertForm({
  ticker,
  tickers,
  currentPrice,
}: {
  /** Fixed ticker — the company page, where the subject is already decided. */
  ticker?: string;
  /** Choices — /alerts, where it is not. */
  tickers?: TickerChoice[];
  currentPrice?: number;
}) {
  const [state, formAction, pending] = useActionState<AlertState, FormData>(
    createAlert,
    undefined,
  );
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <form
        action={formAction}
        // Aligns the controls along their bottom edge, so a wrapped label does
        // not stair-step the fields.
        className="flex flex-wrap items-end gap-x-3 gap-y-4"
      >
        {ticker && <input type="hidden" name="ticker" value={ticker} />}

        {tickers && (
          <div className="relative min-w-[9rem] flex-1 sm:max-w-[13rem]">
            <Label htmlFor={`${id}-ticker`}>Company</Label>
            <select
              id={`${id}-ticker`}
              name="ticker"
              required
              defaultValue=""
              className={`${FIELD} appearance-none pr-9`}
            >
              <option value="" disabled>
                Choose…
              </option>
              {tickers.map((t) => (
                <option key={t.ticker} value={t.ticker}>
                  {t.ticker}
                  {t.companyName ? ` · ${t.companyName}` : ""}
                </option>
              ))}
            </select>
            <Chevron />
          </div>
        )}

        <div className="relative min-w-[8rem] flex-1 sm:max-w-[10rem]">
          {/* Explicit htmlFor rather than wrapping the control. Nesting the
              <select> inside its <label> made the accessible name include every
              option's text — screen readers announced the condition field as
              "Alert me when price is above below". */}
          <Label htmlFor={`${id}-condition`}>
            {tickers ? "Alert when price is" : "Alert me when price is"}
          </Label>
          <select
            id={`${id}-condition`}
            name="condition"
            defaultValue="above"
            className={`${FIELD} appearance-none pr-9`}
          >
            <option value="above">above</option>
            <option value="below">below</option>
          </select>
          <Chevron />
        </div>

        <div className="min-w-[7rem] flex-1 sm:max-w-[9rem]">
          <Label htmlFor={`${id}-threshold`}>Price</Label>
          <input
            id={`${id}-threshold`}
            name="threshold"
            inputMode="decimal"
            required
            aria-describedby={state?.error ? errorId : undefined}
            aria-invalid={state?.error ? true : undefined}
            placeholder={currentPrice ? currentPrice.toFixed(2) : "0.00"}
            className={`${FIELD} font-mono tabular-nums`}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="h-11 shrink-0 bg-[var(--gold)] px-5 text-sm font-medium text-[var(--ground)] transition-opacity hover:opacity-90 disabled:opacity-55"
        >
          {pending ? "Saving…" : "Set alert"}
        </button>
      </form>

      {state?.error && (
        <p
          id={errorId}
          role="alert"
          // A hairline, not a thick coloured bar — the sign and the copy carry
          // the meaning.
          className="mt-3 border-l border-[var(--down)] bg-[var(--raised)] px-3 py-2 text-sm"
        >
          {state.error}
        </p>
      )}
    </div>
  );
}
