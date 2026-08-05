"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeTicker } from "@/lib/market-data";

export type AlertState = { error?: string; ok?: boolean } | undefined;

/**
 * Price alert mutations.
 *
 * Same shape as the watchlist actions and for the same reason: no ownership
 * clause. RLS decides which rows this user may touch.
 */

export async function createAlert(
  _prev: AlertState,
  formData: FormData,
): Promise<AlertState> {
  const ticker = normalizeTicker(String(formData.get("ticker") ?? ""));
  const condition = String(formData.get("condition") ?? "");
  const raw = String(formData.get("threshold") ?? "").trim();

  if (condition !== "above" && condition !== "below") {
    return { error: "Choose whether to alert above or below a price." };
  }

  // Parse before trusting. The DB has a CHECK for positivity, but a friendly
  // message here beats a constraint violation surfacing as "couldn't save".
  const threshold = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return { error: "Enter a price greater than zero." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase.from("price_alerts").insert({
    user_id: user.id,
    ticker,
    condition,
    threshold,
  });

  if (error) {
    console.error("[alerts] insert:", error.code, error.message);
    return { error: "Couldn't save that alert. Try again." };
  }

  // Both surfaces that can create an alert have to be refreshed, not just the
  // one the request came from: /alerts now has its own form, and a company page
  // left in the router cache would show a stale list on the next visit.
  revalidatePath(`/company/${ticker}`);
  revalidatePath("/alerts");
  return { ok: true };
}

export async function deleteAlert(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("price_alerts").delete().eq("id", id);
  if (error) console.error("[alerts] delete:", error.code, error.message);

  const ticker = normalizeTicker(String(formData.get("ticker") ?? ""));
  if (ticker) revalidatePath(`/company/${ticker}`);
  // Deleting from /alerts previously revalidated only the company page, so the
  // row stayed on screen until a hard reload.
  revalidatePath("/alerts");
}
