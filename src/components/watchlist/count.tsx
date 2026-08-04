"use client";

import { useWatchlist } from "@/components/watchlist/optimistic";

/**
 * The tracked count, read from optimistic state.
 *
 * Taking it from the server rows instead left the header saying "1 company
 * tracked" while two cards were on screen — the count and the grid disagreeing
 * for the length of a round trip. Optimism has to be applied to everything
 * derived from the list, or it just moves the inconsistency somewhere else.
 */
export function WatchlistCount() {
  const { items } = useWatchlist();
  if (items.length === 0) return null;
  return (
    <p className="mt-1.5 text-sm text-[var(--dim)]">
      {items.length} {items.length === 1 ? "company" : "companies"} tracked
    </p>
  );
}
