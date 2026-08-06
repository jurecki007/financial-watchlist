/**
 * Creates (or restores) the read-only-ish demo account a reviewer logs in with.
 *
 * Why a script and not a migration: the account lives in `auth.users`, which is
 * GoTrue's table, not ours. Inserting into it by hand means reproducing whatever
 * password-hash format and column set the running GoTrue expects, and that
 * contract changes between releases — a migration that works today silently
 * writes an unusable row after the next platform upgrade. The Admin API is the
 * supported door, so this is a script that calls it rather than SQL we maintain
 * a private copy of.
 *
 * Why it is idempotent: the credentials are published in the README, so anyone
 * who reads the repo can log in and reorder the watchlist. That is an accepted
 * trade-off, not an accident — the mitigation is that this script restores the
 * account to a known state, so re-running it before sending the link is the
 * whole recovery procedure. Every run resets the password, the watchlist and
 * the alerts; nothing here accumulates.
 *
 * Why the account is created pre-confirmed: the deployed project has email
 * confirmation on (`supabase/config.toml` only governs the local stack, which
 * is why the signup page promises a confirmation mail). `email_confirm: true`
 * marks the address verified without sending anything — which matters here
 * beyond convenience, because the demo address is on a domain we do not own.
 *
 * Usage:
 *   npm run seed:demo
 *
 * Requires SUPABASE_SECRET_KEY and the project URL in the environment, or in a
 * .env.local the npm script loads for you.
 */

import { createClient } from "@supabase/supabase-js";

// --- Configuration --------------------------------------------------------

// example.com, and not a real company's domain, on purpose. RFC 2606 reserves
// it precisely so it can be used in documentation without ever resolving, which
// means no mail this account provokes can reach a person who did not ask for
// it. The previous default was a live domain we did not own — a published
// password on an address at somebody else's company is an invitation to send
// them automated mail, and every send would have been a bounce charged against
// our own sending reputation.
const EMAIL = process.env.DEMO_EMAIL ?? "fakturownia@example.com";
const PASSWORD = process.env.DEMO_PASSWORD ?? "ReviewMe2026!";
const DISPLAY_NAME = process.env.DEMO_DISPLAY_NAME ?? "Reviewer";

// Six US large caps across four sectors. US-only because Finnhub's free tier is
// US-only, and news and fundamentals come from Finnhub — a European ticker would
// render a company page with two empty panels and look broken rather than
// unentitled. The sector spread is deliberate: a watchlist that is six tech
// names shows one shade of the delta colour on most days.
const WATCHLIST = [
  { ticker: "AAPL", company_name: "Apple Inc." },
  { ticker: "MSFT", company_name: "Microsoft Corporation" },
  { ticker: "NVDA", company_name: "NVIDIA Corporation" },
  { ticker: "AMZN", company_name: "Amazon.com, Inc." },
  { ticker: "JPM", company_name: "JPMorgan Chase & Co." },
  { ticker: "KO", company_name: "The Coca-Cola Company" },
];

// Two alerts, one in each state the UI can show, and neither can send email.
//
// The evaluator scans `where active and triggered_at is null`, so the fired row
// is invisible to it by construction, and the pending row's threshold is far
// enough below any plausible price that it will not cross during a review.
//
// Both of those still matter now the address is a reserved one. `example.com`
// means a fired alert can no longer reach a person, but it cannot be delivered
// either: `check-price-alerts` mails the account's own address, so every send
// would fail and count as a bounce against the Resend sending domain. The
// account is a display of the product, not a demonstration of mail delivery —
// what it should show a reviewer is both alert states rendered, which is what
// the fired row does without a send. Seeded alerts must not fire.
const ALERTS = [
  {
    ticker: "AAPL",
    condition: "below",
    threshold: 100.0,
    fired: false,
  },
  {
    ticker: "MSFT",
    condition: "above",
    threshold: 400.0,
    fired: true,
  },
];

// --- Environment ----------------------------------------------------------

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

// Named individually — the point of failing early is to say which variable to set.
const missing = [];
if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)");
if (!secret) missing.push("SUPABASE_SECRET_KEY");
if (missing.length > 0) {
  console.error(`Cannot seed the demo account — missing ${missing.join(" and ")}.

Set them in .env.local (npm run seed:demo loads it) or export them first.
The secret key is Settings → API keys → secret (sb_secret_…) in the Supabase
dashboard. It bypasses RLS, which is what lets this script write rows it does
not own — keep it out of git.`);
  process.exit(1);
}

// A publishable key in the secret slot would otherwise surface later as a
// confusing RLS error. Legacy keys are decoded rather than rejected on the
// `eyJ` prefix: anon and service_role share it, and only one is wrong.
if (secret.startsWith("sb_publishable_")) {
  console.error(
    "SUPABASE_SECRET_KEY holds a publishable key. It is subject to RLS and " +
      "cannot write another user's rows — this script needs the secret key.",
  );
  process.exit(1);
}
if (secret.startsWith("eyJ")) {
  let role;
  try {
    role = JSON.parse(
      Buffer.from(secret.split(".")[1], "base64url").toString("utf8"),
    ).role;
  } catch {
    console.error("SUPABASE_SECRET_KEY looks like a JWT but will not decode.");
    process.exit(1);
  }
  if (role !== "service_role") {
    console.error(
      `SUPABASE_SECRET_KEY is a legacy key with role "${role}". This script ` +
        `needs service_role (or a sb_secret_… key); "${role}" is subject to ` +
        `RLS and cannot write another user's rows.`,
    );
    process.exit(1);
  }
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Helpers --------------------------------------------------------------

/**
 * The Admin API has no lookup-by-email, so page until one matches. Bounded so
 * a bad response cannot spin forever.
 */
async function findUserByEmail(email) {
  const target = email.toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(`Could not list users: ${error.message}`);

    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < perPage) return null;
  }
  return null;
}

function fail(step, error) {
  throw new Error(`${step}: ${error.message}`);
}

// --- Seed -----------------------------------------------------------------

async function main() {
  const existing = await findUserByEmail(EMAIL);
  let user = existing;

  if (existing) {
    // Reset rather than recreate: deleting would also change the user id.
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: DISPLAY_NAME },
    });
    if (error) fail("Could not reset the demo user", error);
    console.log(`Reset existing demo user ${EMAIL}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: DISPLAY_NAME },
    });
    if (error) fail("Could not create the demo user", error);
    user = data.user;
    console.log(`Created demo user ${EMAIL}`);
  }

  // The trigger owns this row, so update and never insert. Only matters on a
  // re-run, where metadata changed but no insert fired.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ display_name: DISPLAY_NAME })
    .eq("id", user.id);
  if (profileError) fail("Could not update the demo profile", profileError);

  // Replace wholesale — upserting would leave behind whatever a visitor added.
  const { error: clearWatchlist } = await admin
    .from("watchlist_items")
    .delete()
    .eq("user_id", user.id);
  if (clearWatchlist) fail("Could not clear the watchlist", clearWatchlist);

  // Staggered explicitly: rows inserted in one statement share now() to the
  // microsecond, so the dashboard's added_at ordering would shuffle per run.
  const now = Date.now();
  const { error: insertWatchlist } = await admin.from("watchlist_items").insert(
    WATCHLIST.map((item, i) => ({
      user_id: user.id,
      ...item,
      added_at: new Date(now - i * 3_600_000).toISOString(),
    })),
  );
  if (insertWatchlist) fail("Could not seed the watchlist", insertWatchlist);

  const { error: clearAlerts } = await admin
    .from("price_alerts")
    .delete()
    .eq("user_id", user.id);
  if (clearAlerts) fail("Could not clear the alerts", clearAlerts);

  const { error: insertAlerts } = await admin.from("price_alerts").insert(
    ALERTS.map((alert) => ({
      user_id: user.id,
      ticker: alert.ticker,
      condition: alert.condition,
      threshold: alert.threshold,
      active: !alert.fired,
      triggered_at: alert.fired ? new Date(now - 86_400_000).toISOString() : null,
    })),
  );
  if (insertAlerts) fail("Could not seed the alerts", insertAlerts);

  console.log(
    `Seeded ${WATCHLIST.length} watchlist items and ${ALERTS.length} alerts.`,
  );
  console.log(`\nDemo account ready:\n  email    ${EMAIL}\n  password ${PASSWORD}`);
}

main().catch((error) => {
  // Carries only our step label and the API's message, never the key.
  console.error(`\nSeeding failed — ${error.message}`);
  process.exit(1);
});
