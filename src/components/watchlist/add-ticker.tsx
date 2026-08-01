"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addTicker, type WatchlistState } from "@/app/dashboard/actions";
import type { SymbolMatch } from "@/lib/market-data";

/**
 * Ticker search and add.
 *
 * Loading rule 8: results already on screen stay there while the next query
 * resolves. Blanking the panel on every keystroke is the most common
 * autocomplete mistake — it makes a fast connection feel like a strobe and a
 * slow one feel broken.
 *
 * Search is debounced at 250ms and every in-flight request is aborted when a
 * newer one starts, so a slow early response can never overwrite a fast later
 * one. That reordering bug is invisible on a fast connection and constant on a
 * slow one.
 */
export function AddTicker() {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SymbolMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const [state, formAction, pending] = useActionState<WatchlistState, FormData>(
    addTicker,
    undefined,
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;

      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          // Keep whatever is on screen; say the search failed rather than
          // pretending there were no results, which is a different claim.
          setSearchError("Search is unavailable right now.");
          return;
        }
        const body = (await res.json()) as { matches: SymbolMatch[] };
        setMatches(body.matches ?? []);
        setSearchError(null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSearchError("Search is unavailable right now.");
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div>
      <label className="block">
        <span className="mb-2 block text-sm text-[var(--dim)]">
          Add a company
        </span>
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or symbol"
            autoComplete="off"
            aria-describedby="add-ticker-status"
            className="h-11 w-full border border-[var(--rule-strong)] bg-[var(--raised)] px-3 pr-10 text-[0.95rem] transition-colors placeholder:text-[var(--faint)] hover:border-[var(--faint)] focus:border-[var(--gold)] focus:outline-none"
          />
          {/* Pending indicator lives inside the field, so the results panel
              below is never replaced by a spinner. */}
          {searching && (
            <span
              aria-hidden
              className="absolute top-1/2 right-3 size-3.5 -translate-y-1/2 animate-spin rounded-full border border-[var(--faint)] border-t-transparent motion-reduce:animate-none"
            />
          )}
        </div>
      </label>

      <p id="add-ticker-status" className="sr-only" aria-live="polite">
        {searching
          ? "Searching"
          : matches.length
            ? `${matches.length} results`
            : ""}
      </p>

      {state?.error && (
        <p
          role="alert"
          className="mt-3 border-l-2 border-[var(--down)] bg-[var(--raised)] px-3 py-2 text-sm"
        >
          {state.error}
        </p>
      )}
      {searchError && (
        <p className="mt-3 text-sm text-[var(--dim)]">{searchError}</p>
      )}

      {matches.length > 0 && (
        <ul className="mt-2 max-h-64 overflow-y-auto border border-[var(--rule)] bg-[var(--raised)]">
          {matches.map((m) => (
            <li key={`${m.ticker}-${m.exchange ?? ""}`}>
              <form action={formAction}>
                <input type="hidden" name="ticker" value={m.ticker} />
                <input type="hidden" name="company_name" value={m.name} />
                <button
                  type="submit"
                  disabled={pending}
                  className="flex w-full items-baseline gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--ground)] disabled:opacity-50"
                >
                  <span className="font-mono text-sm">{m.ticker}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--dim)]">
                    {m.name}
                  </span>
                  {m.exchange && (
                    <span className="font-mono text-[11px] text-[var(--faint)]">
                      {m.exchange}
                    </span>
                  )}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length >= 2 && !searching && matches.length === 0 && !searchError && (
        <p className="mt-3 text-sm text-[var(--dim)]">
          No companies match “{query.trim()}”.
        </p>
      )}
    </div>
  );
}
