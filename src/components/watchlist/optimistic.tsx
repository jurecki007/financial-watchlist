"use client";

import {
  createContext,
  useContext,
  useOptimistic,
  type ReactNode,
} from "react";

/**
 * Optimistic add and remove. The control and the grid sit either side of a
 * Suspense boundary, so the state lives in a provider spanning both.
 *
 * `useOptimistic` rather than `useState`: React discards the optimistic value
 * when the transition settles. Hand-rolled state has to be cleared manually,
 * and a missed clear shows rows the database does not contain.
 */

export type Item = {
  id: string;
  ticker: string;
  company_name: string | null;
  /** True while the server has not yet confirmed this row. */
  pending?: boolean;
};

type Action =
  | { type: "add"; ticker: string; name: string | null }
  | { type: "remove"; ticker: string };

type Ctx = {
  items: Item[];
  optimisticAdd: (ticker: string, name: string | null) => void;
  optimisticRemove: (ticker: string) => void;
};

const WatchlistContext = createContext<Ctx | null>(null);

export function useWatchlist(): Ctx {
  const ctx = useContext(WatchlistContext);
  if (!ctx) {
    // A no-op rather than a throw: a missing provider should not take the page
    // down, and the forms still work through the server action either way.
    return { items: [], optimisticAdd: () => {}, optimisticRemove: () => {} };
  }
  return ctx;
}

function reduce(state: Item[], action: Action): Item[] {
  if (action.type === "remove") {
    return state.filter((i) => i.ticker !== action.ticker);
  }
  // Adding something already listed must not duplicate it. The database has a
  // unique constraint that makes the insert a no-op; the UI has to agree.
  if (state.some((i) => i.ticker === action.ticker)) return state;
  return [
    {
      id: `pending-${action.ticker}`,
      ticker: action.ticker,
      company_name: action.name,
      pending: true,
    },
    ...state,
  ];
}

export function WatchlistProvider({
  items,
  children,
}: {
  items: Item[];
  children: ReactNode;
}) {
  const [optimisticItems, dispatch] = useOptimistic(items, reduce);

  return (
    <WatchlistContext.Provider
      value={{
        items: optimisticItems,
        optimisticAdd: (ticker, name) =>
          dispatch({ type: "add", ticker, name }),
        optimisticRemove: (ticker) => dispatch({ type: "remove", ticker }),
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}
