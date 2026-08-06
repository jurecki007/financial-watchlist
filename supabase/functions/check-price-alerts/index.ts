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

/**
 * Tickers arrive from `price_alerts`, where the only guards are upper-case and
 * a 20-character cap. `<B>`, and `<IMG SRC=X ONERROR=…>` at 20 characters,
 * both satisfy those — upper-casing does not disarm markup. This email is the
 * one place a ticker is rendered as HTML, so the escape belongs here. Same
 * reasoning as `serialiseJsonLd` on the web side: the values are trustworthy
 * today, and the guard is for the edit that is not.
 */
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Equity prices are two-decimal. `threshold` is numeric(20,6) and arrives as
// 180.5, which reads as a typo next to a price of 180.12 unless both are fixed
// to the same width.
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

// Shared with the auth templates in supabase/templates/. The duplication is
// forced: those are Go templates read by GoTrue, this is a Deno string, and no
// build step spans both. Keep the tokens in step by hand — they are the
// design-system values from globals.css.
const GROUND = "#08090b";
const RAISED = "#101216";
const RULE = "#23262b";
const FG = "#ecedef";
const DIM = "#9a9ca1";
// globals.css spends --faint #6b6e74 on this role, and it measures 3.90:1 on
// the ground and 3.67:1 on the raised panel — under the 4.5:1 floor for body
// text. The app gets away with it because every --faint string is repeated in
// a louder form nearby, and because the reader can switch themes. An email has
// neither escape hatch, so the tone is lifted to the nearest value that clears
// AA against both surfaces (5.03:1 and 4.74:1) while staying visually quiet.
const MUTED = "#7d8086";
const GOLD = "#d9a441";
const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO =
  "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

function email(a: Alert, price: number) {
  const up = a.condition === "above";
  const dir = up ? "risen above" : "fallen below";

  // Colour carries the direction, but never alone — the arrow and the word
  // survive a colourblind reader and a client that strips colour. Same rule as
  // the deltas on the dashboard.
  const tone = up ? "#2dd4bf" : "#f87171";
  const arrow = up ? "&#9650;" : "&#9660;";
  const arrowText = up ? "^" : "v";

  const ticker = esc(a.ticker);
  const last = money(price);
  const level = money(a.threshold);
  const href = `${APP_URL}/company/${encodeURIComponent(a.ticker)}`;
  const subject = `${a.ticker} has ${dir} ${level}`;

  return {
    subject,
    // A text/plain part is not a courtesy. Without one the message is a
    // single-part text/html mail, which every spam filter scores against, and
    // which reads as blank on a watch or a screen reader in plain-text mode.
    text: [
      `${a.ticker} has ${dir} ${level}`,
      ``,
      `Last traded   ${arrowText} ${last}`,
      `Your alert    ${a.condition} ${level}`,
      ``,
      `View ${a.ticker}: ${href}`,
      ``,
      `This alert has now been used up and will not send again.`,
      `Set a new one from the company page.`,
    ].join("\n"),
    html: `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(subject)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  :root { color-scheme: dark; supported-color-schemes: dark; }
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  a { text-decoration: none; }
  @media only screen and (max-width:600px) {
    .sm-px { padding-left:22px !important; padding-right:22px !important; }
    .sm-full { width:100% !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${GROUND};">

<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
  Last traded at ${last}. This alert has been used up and will not send again.
  &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${GROUND}" style="background-color:${GROUND};">
  <tr>
    <td align="center" style="padding:40px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" class="sm-full" style="width:560px;max-width:560px;">

        <tr>
          <td class="sm-px" style="padding:0 0 22px 0;font-family:${MONO};font-size:11px;line-height:16px;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};">
            Financial Watchlist
          </td>
        </tr>

        <tr>
          <td bgcolor="${RAISED}" style="background-color:${RAISED};border:1px solid ${RULE};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td class="sm-px" style="padding:34px 38px 32px 38px;">

                  <p style="margin:0 0 16px 0;font-family:${MONO};font-size:11px;line-height:16px;letter-spacing:0.16em;text-transform:uppercase;color:${GOLD};">
                    Price alert
                  </p>

                  <h1 style="margin:0 0 24px 0;font-family:${SANS};font-size:23px;line-height:31px;font-weight:600;letter-spacing:-0.02em;color:${FG};">
                    ${ticker} has ${dir} ${level}
                  </h1>

                  <!-- Readout. Labels left, figures right in the mono face so
                       the two numbers line up on the decimal. -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${GROUND}" style="background-color:${GROUND};border:1px solid ${RULE};">
                    <tr>
                      <td style="padding:16px 20px 6px 20px;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${MUTED};">
                        Last traded
                      </td>
                      <td align="right" style="padding:16px 20px 6px 20px;font-family:${MONO};font-size:24px;line-height:30px;font-weight:600;color:${tone};white-space:nowrap;">
                        <span style="font-size:16px;">${arrow}</span>&nbsp;${last}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 20px 16px 20px;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${MUTED};">
                        Your alert
                      </td>
                      <td align="right" style="padding:0 20px 16px 20px;font-family:${MONO};font-size:13px;line-height:20px;color:${DIM};white-space:nowrap;">
                        ${a.condition}&nbsp;${level}
                      </td>
                    </tr>
                  </table>

                  <div style="height:26px;line-height:26px;font-size:0;">&nbsp;</div>

                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:46px;v-text-anchor:middle;width:190px;" arcsize="0%" stroke="f" fillcolor="${GOLD}">
                    <w:anchorlock/>
                    <center style="color:${GROUND};font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;">View ${ticker}</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-- -->
                  <a href="${href}" style="display:inline-block;background-color:${GOLD};color:${GROUND};font-family:${SANS};font-size:15px;font-weight:600;line-height:20px;padding:13px 26px;text-decoration:none;">
                    View ${ticker}
                  </a>
                  <!--<![endif]-->

                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="sm-px" style="padding:22px 2px 0 2px;font-family:${SANS};font-size:12px;line-height:20px;color:${MUTED};">
            This alert has been used up and will not send again. Set a new one
            from the company page.
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`.trim(),
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

      const { subject, html, text } = email(alert, price);
      const send = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        // `text` alongside `html` makes this multipart/alternative. Sending
        // html on its own is a measurable spam signal and leaves plain-text
        // readers with an empty message.
        body: JSON.stringify({ from: FROM, to, subject, html, text }),
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
