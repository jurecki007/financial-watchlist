"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addTicker, type WatchlistState } from "@/app/dashboard/actions";
import type { SymbolMatch } from "@/lib/market-data";
import { useToast } from "@/components/ui/toast";
import { suggestionsFor } from "@/lib/popular-tickers";
import { useWatchlist } from "@/components/watchlist/optimistic";

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
/**
 * Every panel that can appear under the field shares this. All of them are
 * absolutely positioned: anything in normal flow here changes the height of
 * the header and shoves the card grid down the page, which is what made
 * clicking the field feel like the layout exploding.
 *
 * The shadow is what makes it read as a layer over the page rather than a
 * block that grew out of the input.
 */
const PANEL =
  "absolute top-[calc(100%+0.5rem)] right-0 left-0 z-30 border border-[var(--rule-strong)] bg-[var(--raised)] shadow-xl shadow-black/50";

/** Shared by suggestions and search results so the two cannot diverge. */
function Row({
  ticker,
  name,
  meta,
  formAction,
  pending,
  index,
  active,
}: {
  ticker: string;
  name: string;
  meta?: string;
  formAction: (formData: FormData) => void;
  pending: boolean;
  index: number;
  active: boolean;
}) {
  const { optimisticAdd } = useWatchlist();
  return (
    <li role="none">
      {/* The card appears immediately; the server action confirms it. The
          dispatch must sit inside the action — React only accepts optimistic
          updates within an action's transition. */}
      <form
        action={(formData: FormData) => {
          optimisticAdd(ticker, name);
          formAction(formData);
        }}
      >
        <input type="hidden" name="ticker" value={ticker} />
        <input type="hidden" name="company_name" value={name} />
        <button
          type="submit"
          id={`opt-${index}`}
          role="option"
          aria-selected={active}
          disabled={pending}
          className={`flex w-full items-baseline gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
            active ? "bg-[var(--ground)]" : "hover:bg-[var(--ground)]"
          }`}
        >
          <span className="font-mono text-sm">{ticker}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--dim)]">
            {name}
          </span>
          {meta && (
            <span className="font-mono text-[11px] text-[var(--faint)]">
              {meta}
            </span>
          )}
        </button>
      </form>
    </li>
  );
}

export function AddTicker({ watched = [] }: { watched?: string[] }) {
  const [focused, setFocused] = useState(false);
  // Which row the keyboard is on. -1 means the field itself.
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SymbolMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const { push } = useToast();

  // Suggestions stand in for results only while the field is empty. Once two
  // characters are typed the real search owns the panel — showing both would
  // put two lists of companies on screen with no way to tell which responds
  // to what was typed.
  const suggestions = suggestionsFor(watched);
  const showSuggestions =
    focused && query.trim().length < 2 && suggestions.length > 0;
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

  useEffect(() => {
    setActive(-1);
  }, [query, focused]);

  return (
    // `relative` anchors the overlay; the panel below is absolute so opening
    // it cannot change the height of anything around it.
    <div className="relative">
      <label className="block">
        <span className="mb-2 block text-sm text-[var(--dim)]">
          Add a company
        </span>
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            role="combobox"
            aria-expanded={showSuggestions || matches.length > 0}
            aria-controls="ticker-options"
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `opt-${active}` : undefined}
            onKeyDown={(e) => {
              const rows = listRef.current?.querySelectorAll("button") ?? [];
              if (rows.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => (i + 1) % rows.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => (i <= 0 ? rows.length - 1 : i - 1));
              } else if (e.key === "Enter" && active >= 0) {
                // Only intercept Enter when a row is highlighted; otherwise the
                // field should behave like a field.
                e.preventDefault();
                (rows[active] as HTMLButtonElement).click();
              } else if (e.key === "Escape") {
                setFocused(false);
                setActive(-1);
              }
            }}
            // A click on a suggestion has to land before blur removes it, so
            // the panel closes on the next tick rather than immediately.
            onBlur={() => setTimeout(() => setFocused(false), 150)}
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
          className={`${PANEL} border-l-2 border-l-[var(--down)] px-3 py-2 text-sm`}
        >
          {state.error}
        </p>
      )}
      {searchError && (
        <p className={`${PANEL} px-3 py-2 text-sm text-[var(--dim)]`}>
          {searchError}
        </p>
      )}

      {showSuggestions && (
        <ul id="ticker-options" role="listbox" ref={listRef} className={PANEL}>
          {/* Labelled, so it never reads as a result of what was typed. */}
          <li className="border-b border-[var(--rule)] px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--faint)] uppercase">
            Popular
          </li>
          {suggestions.map((p, i) => (
            <Row
              key={p.ticker}
              index={i}
              active={active === i}
              ticker={p.ticker}
              name={p.name}
              formAction={formAction}
              pending={pending}
            />
          ))}
        </ul>
      )}

      {matches.length > 0 && (
        <ul id="ticker-options" role="listbox" ref={listRef} className={`${PANEL} max-h-72 overflow-y-auto`}>
          {matches.map((m, i) => (
            <Row
              key={`${m.ticker}-${m.exchange ?? ""}`}
              index={i}
              active={active === i}
              ticker={m.ticker}
              name={m.name}
              meta={m.exchange}
              formAction={formAction}
              pending={pending}
            />
          ))}
        </ul>
      )}

      {query.trim().length >= 2 &&
        !searching &&
        matches.length === 0 &&
        !searchError && (
          <p className={`${PANEL} px-3 py-2 text-sm text-[var(--dim)]`}>
            No companies match “{query.trim()}”.
          </p>
        )}
    </div>
  );
}
