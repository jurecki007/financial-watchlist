"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeTicker } from "@/lib/market-data";

export type WatchlistState = { error?: string } | undefined;

/**
 * Watchlist mutations. Note the absent `where user_id = ...`: RLS enforces
 * ownership, and an application-layer copy of that rule would only drift.
 *
 * user_id is still set on insert, because WITH CHECK compares against it —
 * the row has to claim an owner for the database to verify the claim.
 */

export async function addTicker(
  _prev: WatchlistState,
  formData: FormData,
): Promise<WatchlistState> {
  const ticker = normalizeTicker(String(formData.get("ticker") ?? ""));
  const companyName = String(formData.get("company_name") ?? "") || null;

  if (!ticker) return { error: "Pick a company to add." };
  if (ticker.length > 20) return { error: "That symbol doesn't look right." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("watchlist_items")
    .insert({ user_id: user.id, ticker, company_name: companyName });

  if (error) {
    // 23505 is the unique(user_id, ticker) constraint. Not worth alarming
    // anyone about — the desired end state already holds.
    if (error.code === "23505") return undefined;
    console.error("[watchlist] insert:", error.code, error.message);
    return { error: "Couldn't add that company. Try again." };
  }

  revalidatePath("/dashboard");
  return undefined;
}

export async function removeTicker(formData: FormData): Promise<void> {
  const ticker = normalizeTicker(String(formData.get("ticker") ?? ""));
  if (!ticker) return;

  const supabase = await createClient();
  // No ownership check: a row belonging to someone else matches zero rows
  // under the DELETE policy, which the RLS suite asserts.
  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("ticker", ticker);

  if (error) console.error("[watchlist] delete:", error.code, error.message);
  revalidatePath("/dashboard");
}
