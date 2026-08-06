/**
 * Evaluates active price alerts and emails the ones that have triggered.
 *
 * One quote request covers every distinct ticker across all users — Twelve
 * Data allows 8 a minute, so one call per alert would not scale.
 *
 * Uses the service key, so RLS does not apply: it must read every user's
 * alerts, which is exactly what RLS prevents for clients.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWELVE_DATA_API_KEY = Deno.env.get("TWELVE_DATA_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
// Must name the domain verified in Resend, and match the site's own domain: a
// mismatched sender reads as a phish, and an unverified one is rejected with a
// 403 that creates no email record, so the failure is invisible.
const FROM =
  Deno.env.get("ALERTS_FROM") ?? "alerts@financial-demo.nyxiontech.com";
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
 * A ticker's only guards are upper-case and a 20-character cap, both of which
 * `<B>` satisfies — upper-casing does not disarm markup. This email is the one
 * place a ticker is rendered as HTML.
 */
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// `threshold` is numeric(20,6) and arrives as 180.5, which reads as a typo
// beside a price of 180.12 unless both are fixed to two decimals.
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

// Mirrors the tokens in globals.css. Duplicated by necessity: the auth
// templates are Go templates read by GoTrue, and no build step spans both.
const GROUND = "#08090b";
const RAISED = "#101216";
const RULE = "#23262b";
const FG = "#ecedef";
const DIM = "#9a9ca1";
// Lifted above --faint (#6b6e74), which measures 3.90:1 on the ground — under
// the 4.5:1 floor, and email has no theme toggle to escape to.
const MUTED = "#7d8086";
const GOLD = "#d9a441";
const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO =
  "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

function email(a: Alert, price: number) {
  const up = a.condition === "above";
  const dir = up ? "risen above" : "fallen below";

  // Colour never carries direction alone — the arrow and the word survive a
  // colourblind reader and a client that strips colour.
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
    // Without a plain-text part the message is html-only, which spam filters
    // score against and plain-text readers render blank.
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
  // Deployed --no-verify-jwt so the scheduler can call it without a token,
  // which leaves the URL reachable by anyone who finds it. The shared secret is
  // the gate; the comparison is timing-safe because it costs nothing to be.
  const provided = req.headers.get("x-cron-secret") ?? "";
  const expected = Deno.env.get("CRON_SECRET") ?? "";
  const ok =
    expected.length > 0 &&
    provided.length === expected.length &&
    provided.split("").reduce((acc, ch, i) => acc | (ch.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0;
  if (!ok) return new Response("forbidden", { status: 403 });

  // Optional scope, used by alert creation so an already-met threshold fires
  // at once. The cron passes none and gets the full sweep.
  //
  // Matched against a charset rather than escaped: this is interpolated into a
  // PostgREST filter, where `ticker=eq.X&active=is.false` is a different query,
  // not a quoting bug. Anything unexpected falls back to the unscoped sweep.
  const requested = new URL(req.url).searchParams.get("ticker")?.toUpperCase();
  const scope = requested && /^[A-Z0-9.\-]{1,20}$/.test(requested)
    ? requested
    : "";

  const started = Date.now();
  try {
    const alerts: Alert[] = await db(
      "price_alerts?select=id,user_id,ticker,condition,threshold&active=is.true&triggered_at=is.null" +
        (scope ? `&ticker=eq.${scope}` : ""),
    );

    if (alerts.length === 0) {
      return Response.json({
        scope: scope || "all",
        checked: 0,
        sent: 0,
        ms: Date.now() - started,
      });
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

      // Claim before sending: a duplicate alert reads as a second crossing
      // that never happened, while a missed one is merely late.
      //
      // Compare-and-set, not a blind write — `triggered_at=is.null` puts the
      // test in the UPDATE's own WHERE clause so only one caller can win, and
      // an empty result means somebody else got there first. The hourly sweep
      // and the create-time check can be in flight on the same row at once.
      const claimed = await db(
        `price_alerts?id=eq.${alert.id}&triggered_at=is.null`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            triggered_at: new Date().toISOString(),
            active: false,
          }),
        },
      );
      if (!claimed?.length) continue;

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
        // `text` alongside `html` makes this multipart/alternative.
        body: JSON.stringify({ from: FROM, to, subject, html, text }),
      });

      if (!send.ok) {
        console.error("[alerts] resend failed", await send.text());
        continue;
      }
      sent += 1;
    }

    return Response.json({
      scope: scope || "all",
      checked: alerts.length,
      sent,
      ms: Date.now() - started,
    });
  } catch (err) {
    console.error("[alerts] run failed", err);
    return Response.json({ error: "run_failed" }, { status: 500 });
  }
});
