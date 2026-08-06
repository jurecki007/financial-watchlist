"use client";

import { useWatchlist } from "@/components/watchlist/optimistic";

/**
 * The tracked count, read from optimistic state — from the server rows it would
 * disagree with the grid for the length of a round trip.
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
