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

/**
 * Ask the evaluator to look at this ticker now.
 *
 * Without it, an alert whose condition is already true sits looking pending
 * until the hourly sweep — "alert me when AAPL is above $1" reads as broken for
 * up to an hour, because nothing in the create path ever compared a price to a
 * threshold.
 *
 * Three properties matter more than speed here:
 *
 * - **It cannot fail the creation.** The alert is already committed. If the
 *   evaluator is down, rate-limited, or slow, the row still exists and the
 *   hourly sweep will catch it — so every failure path below is a log and a
 *   return, never a thrown error.
 * - **It is bounded.** A server action that awaits an upstream quote call with
 *   no timeout hands Twelve Data control of how long the user's form submit
 *   takes. Four seconds is longer than the call needs and shorter than a user
 *   will sit staring at a pending button.
 * - **It is scoped to one ticker**, so creating an alert costs a single quote
 *   credit rather than a sweep of every symbol anyone is watching.
 *
 * It is awaited rather than fired and forgotten because the `revalidatePath`
 * below has to run *after* the row may have been marked triggered — otherwise
 * the page re-renders from a snapshot taken before the send and shows the alert
 * as pending anyway, which is the bug this is meant to fix.
 */
async function checkNow(ticker: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.CRON_SECRET;

  // Absent config is not an error: local dev and preview deploys legitimately
  // run without the evaluator wired up, and the sweep remains the guarantee.
  if (!base || !secret) {
    console.warn(
      "[alerts] skipping the immediate check — " +
        (!base ? "NEXT_PUBLIC_SUPABASE_URL" : "CRON_SECRET") +
        " is not set. The alert was saved and the hourly sweep still covers it.",
    );
    return;
  }

  try {
    const res = await fetch(
      `${base}/functions/v1/check-price-alerts?ticker=${encodeURIComponent(ticker)}`,
      {
        method: "POST",
        headers: { "x-cron-secret": secret },
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!res.ok) {
      // Body, not just status: the evaluator answers 503 with a reason when the
      // provider is unavailable, and that is the interesting half.
      console.error("[alerts] immediate check failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[alerts] immediate check did not complete:", err);
  }
}

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

  await checkNow(ticker);

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
