/**
 * Evaluates active price alerts and emails the ones that have triggered.
 *
 * Runs on a schedule rather than while a user happens to be watching — that is
 * the whole point of the feature, and the reason it lives in an edge function
 * instead of a request handler.
 *
 * Design notes:
 * - One quote request for ALL distinct tickers across every user's alerts.
 *   Twelve Data allows 8 requests a minute; one call per alert would exceed
 *   that with a dozen users.
 * - `triggered_at` is set BEFORE the email is sent. Sending twice is worse
 *   than not sending: a duplicate price alert reads as a second crossing that
 *   did not happen. A send that fails after the flag is set is logged and the
 *   alert simply does not re-fire, which is the safer direction to fail in.
 * - Uses the service key, so RLS does not apply. It must read every user's
 *   alerts, which is exactly the case RLS is designed to prevent for clients.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWELVE_DATA_API_KEY = Deno.env.get("TWELVE_DATA_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = Deno.env.get("ALERTS_FROM") ?? "alerts@finance-demo.nyxiontech.com";
const APP_URL =
  Deno.env.get("APP_URL") ?? "https://financial-demo.nyxiontech.com";

type Alert = {
  id: string;
  user_id: string;
  ticker: string;
  condition: "above" | "below";
  threshold: number;
};

const db = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

function fired(a: Alert, price: number): boolean {
  return a.condition === "above" ? price >= a.threshold : price <= a.threshold;
}

function email(a: Alert, price: number) {
  const dir = a.condition === "above" ? "risen above" : "fallen below";
  return {
    subject: `${a.ticker} has ${dir} ${a.threshold}`,
    html: `
<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px">
  <p style="font-family:ui-monospace,monospace;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#6b6e74;margin:0 0 18px">
    Financial Watchlist
  </p>
  <h1 style="font-size:20px;font-weight:600;margin:0 0 12px;color:#111">
    ${a.ticker} has ${dir} ${a.threshold}
  </h1>
  <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 20px">
    It last traded at <strong>${price}</strong>. You asked to be told when it
    went ${a.condition} ${a.threshold}.
  </p>
  <a href="${APP_URL}/company/${encodeURIComponent(a.ticker)}"
     style="display:inline-block;background:#d9a441;color:#08090b;text-decoration:none;padding:10px 18px;font-size:14px;font-weight:500">
    View ${a.ticker}
  </a>
  <p style="font-size:12px;color:#8a8d93;margin:24px 0 0;line-height:1.6">
    This alert has now been used up and will not send again. Set a new one from
    the company page.
  </p>
</div>`.trim(),
  };
}

Deno.serve(async (req) => {
  // Deployed with --no-verify-jwt so the scheduler can call it without minting
  // a token, which means this endpoint is reachable by anyone who knows the
  // URL. Without a check, a stranger could hammer it and spend the Twelve Data
  // daily budget. The shared secret is the gate.
  //
  // Timing-safe comparison is overkill for a header this long, but constant
  // work costs nothing here and removes the question entirely.
  const provided = req.headers.get("x-cron-secret") ?? "";
  const expected = Deno.env.get("CRON_SECRET") ?? "";
  const ok =
    expected.length > 0 &&
    provided.length === expected.length &&
    provided.split("").reduce((acc, ch, i) => acc | (ch.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0;
  if (!ok) return new Response("forbidden", { status: 403 });

  const started = Date.now();
  try {
    const alerts: Alert[] = await db(
      "price_alerts?select=id,user_id,ticker,condition,threshold&active=is.true&triggered_at=is.null",
    );

    if (alerts.length === 0) {
      return Response.json({ checked: 0, sent: 0, ms: Date.now() - started });
    }

    // One request for every distinct ticker across all users.
    const tickers = [...new Set(alerts.map((a) => a.ticker))];
    const quoteRes = await fetch(
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(
        tickers.join(","),
      )}&apikey=${TWELVE_DATA_API_KEY}`,
    );
    const quoteBody = await quoteRes.json();

    if (quoteBody?.status === "error") {
      // Rate limited or down. Do nothing and let the next run retry — firing
      // on absent data would be worse than firing late.
      console.error("[alerts] quote error", quoteBody.code, quoteBody.message);
      return Response.json({ error: "quote_unavailable" }, { status: 503 });
    }

    const prices = new Map<string, number>();
    if (tickers.length === 1) {
      const p = Number(quoteBody?.close);
      if (Number.isFinite(p)) prices.set(tickers[0], p);
    } else {
      for (const [sym, q] of Object.entries(quoteBody ?? {})) {
        const p = Number((q as { close?: string })?.close);
        if (Number.isFinite(p)) prices.set(sym.toUpperCase(), p);
      }
    }

    let sent = 0;
    for (const alert of alerts) {
      const price = prices.get(alert.ticker);
      if (price === undefined || !fired(alert, price)) continue;

      // Claim the alert BEFORE sending. A duplicate alert reads as a second
      // crossing that never happened; a missed one is merely late.
      await db(`price_alerts?id=eq.${alert.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          triggered_at: new Date().toISOString(),
          active: false,
        }),
      });

      const users = await db(`profiles?select=id&id=eq.${alert.user_id}`);
      if (!users?.length) continue;

      // auth.users is not exposed over REST; the admin endpoint is.
      const authRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${alert.user_id}`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        },
      );
      const authUser = await authRes.json();
      const to = authUser?.email;
      if (!to) continue;

      const { subject, html } = email(alert, price);
      const send = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM, to, subject, html }),
      });

      if (!send.ok) {
        console.error("[alerts] resend failed", await send.text());
        continue;
      }
      sent += 1;
    }

    return Response.json({
      checked: alerts.length,
      sent,
      ms: Date.now() - started,
    });
  } catch (err) {
    console.error("[alerts] run failed", err);
    return Response.json({ error: "run_failed" }, { status: 500 });
  }
});
