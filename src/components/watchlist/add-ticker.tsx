"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addTicker, type WatchlistState } from "@/app/dashboard/actions";
import type { SymbolMatch } from "@/lib/market-data";
import { useToast } from "@/components/ui/toast";

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
  const { push } = useToast();
  // Read inside the debounce callback without making it a dependency.
  const matchesRef = useRef<SymbolMatch[]>([]);

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
          // Results already on screen stay; the failure is transient, so it
          // goes to a toast rather than replacing what the user is reading.
          // Keyed by status so a burst of 429s is reported once.
          push({
            key: `search-${res.status}`,
            title:
              res.status === 429
                ? "Refreshing shortly"
                : "Search is unavailable",
            body:
              res.status === 429
                ? "We're searching faster than our data feed allows. Try again in a moment."
                : "Our market data provider isn't responding right now.",
          });
          if (matchesRef.current.length === 0) {
            setSearchError("Search is unavailable right now.");
          }
          return;
        }
        const body = (await res.json()) as { matches: SymbolMatch[] };
        matchesRef.current = body.matches ?? [];
        setMatches(body.matches ?? []);
        setSearchError(null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          push({
            key: "search-network",
            title: "Search is unavailable",
            body: "Check your connection and try again.",
          });
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, push]);

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
