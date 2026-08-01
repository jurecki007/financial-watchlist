/**
 * Cross-user isolation tests for Row Level Security.
 *
 * These exist because reading a policy proves nothing. `using (auth.uid() =
 * user_id)` looks correct in every wrong version of itself — the failure modes
 * (a missing WITH CHECK, a policy granted to the wrong role, RLS enabled but
 * bypassed by a client holding the secret key) all still *read* fine. The only
 * way to know isolation holds is to hold two real sessions and try to cross
 * between them.
 *
 * Run against the local stack:  npm run test:rls
 *
 * Every test asserts the DENIED case. A passing suite means the database
 * refused something, not that it allowed something.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54421";
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const SECRET = process.env.SUPABASE_SECRET_KEY ?? "";

if (!PUBLISHABLE || !SECRET) {
  throw new Error(
    "SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY must be set.\n" +
      "For the local stack: npm run test:rls (which sources them from `supabase status`).",
  );
}

/** Bypasses RLS. Used only to create fixtures and to prove rows really exist. */
const admin = createClient(URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Actor = { id: string; email: string; db: SupabaseClient };

async function createActor(label: string): Promise<Actor> {
  const email = `${label}-${crypto.randomUUID()}@example.test`;
  const password = crypto.randomUUID();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(error, null, `creating ${label}: ${error?.message}`);
  const id = data.user!.id;

  // A separate client per actor, holding only the publishable key — exactly
  // what the browser gets. Anything these clients can do, a user can do.
  const db = createClient(URL, PUBLISHABLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await db.auth.signInWithPassword({
    email,
    password,
  });
  assert.equal(error, null, `signing in ${label}: ${signInError?.message}`);

  return { id, email, db };
}

let alice: Actor;
let bob: Actor;
let aliceItemId: string;

before(async () => {
  alice = await createActor("alice");
  bob = await createActor("bob");

  const { data, error } = await alice.db
    .from("watchlist_items")
    .insert({ user_id: alice.id, ticker: "AAPL", company_name: "Apple Inc." })
    .select()
    .single();
  assert.equal(error, null, `alice seeding her watchlist: ${error?.message}`);
  aliceItemId = data!.id;
});

after(async () => {
  // Cascades to profiles and watchlist_items.
  if (alice) await admin.auth.admin.deleteUser(alice.id);
  if (bob) await admin.auth.admin.deleteUser(bob.id);
});

describe("profiles", () => {
  test("a profile row is created by the trigger, not the client", async () => {
    const { data, error } = await alice.db
      .from("profiles")
      .select("id, display_name")
      .eq("id", alice.id)
      .single();

    assert.equal(error, null);
    assert.equal(data!.id, alice.id);
    // Email/password signup has no name metadata, so the trigger falls back to
    // the local part of the address.
    assert.ok(data!.display_name?.startsWith("alice-"));
  });

  test("a user cannot read another user's profile", async () => {
    const { data, error } = await bob.db
      .from("profiles")
      .select("*")
      .eq("id", alice.id);

    // RLS filters rather than raising: the row is invisible, not forbidden.
    assert.equal(error, null);
    assert.deepEqual(data, []);
  });
});

describe("watchlist_items — cross-user isolation", () => {
  test("the row genuinely exists (guards against a vacuous pass)", async () => {
    // Without this, every assertion below would also pass against an empty
    // table — the suite would prove nothing while looking green.
    const { data, error } = await admin
      .from("watchlist_items")
      .select("id, user_id, ticker")
      .eq("id", aliceItemId)
      .single();

    assert.equal(error, null);
    assert.equal(data!.user_id, alice.id);
    assert.equal(data!.ticker, "AAPL");
  });

  test("alice can read her own item", async () => {
    const { data, error } = await alice.db
      .from("watchlist_items")
      .select("id")
      .eq("id", aliceItemId);

    assert.equal(error, null);
    assert.equal(data!.length, 1);
  });

  test("bob cannot read alice's item", async () => {
    const { data, error } = await bob.db
      .from("watchlist_items")
      .select("*")
      .eq("id", aliceItemId);

    assert.equal(error, null);
    assert.deepEqual(data, [], "bob saw a row he does not own");
  });

  test("bob cannot insert a row owned by alice", async () => {
    // This is what WITH CHECK on the INSERT policy defends. A USING-only
    // policy would let this through: bob could not *read* the row afterwards,
    // but he would have written into her account.
    const { error } = await bob.db
      .from("watchlist_items")
      .insert({ user_id: alice.id, ticker: "TSLA" });

    assert.notEqual(error, null, "bob wrote a row owned by alice");
    assert.equal(error!.code, "42501"); // insufficient_privilege
  });

  test("bob cannot update alice's item", async () => {
    const { data, error } = await bob.db
      .from("watchlist_items")
      .update({ ticker: "MSFT" })
      .eq("id", aliceItemId)
      .select();

    assert.equal(error, null);
    assert.deepEqual(data, [], "bob's update matched a row he does not own");

    // Confirm through the admin client that nothing actually changed.
    const { data: after } = await admin
      .from("watchlist_items")
      .select("ticker")
      .eq("id", aliceItemId)
      .single();
    assert.equal(after!.ticker, "AAPL");
  });

  test("bob cannot delete alice's item", async () => {
    const { error } = await bob.db
      .from("watchlist_items")
      .delete()
      .eq("id", aliceItemId);
    assert.equal(error, null);

    const { data: survivor } = await admin
      .from("watchlist_items")
      .select("id")
      .eq("id", aliceItemId)
      .maybeSingle();
    assert.notEqual(survivor, null, "bob deleted a row he does not own");
  });

  test("alice cannot reassign her own row to bob", async () => {
    // The other half of WITH CHECK on UPDATE: owning a row must not let you
    // push it into someone else's account.
    const { error } = await alice.db
      .from("watchlist_items")
      .update({ user_id: bob.id })
      .eq("id", aliceItemId)
      .select();

    assert.notEqual(error, null, "alice moved her row into bob's account");
    assert.equal(error!.code, "42501");
  });
});

describe("cache tables are server-only", () => {
  // RLS is enabled with zero policies, so these are unreachable by anyone
  // holding the publishable key. Otherwise a client could enumerate every
  // ticker the entire user base follows.
  for (const table of ["quote_cache", "news_cache"]) {
    test(`${table} is invisible to an authenticated user`, async () => {
      await admin
        .from(table)
        .upsert({
          ticker: "AAPL",
          [table === "quote_cache" ? "quote_json" : "article_json"]: {
            probe: true,
          },
        });

      const { data, error } = await alice.db.from(table).select("*");
      assert.equal(error, null);
      assert.deepEqual(data, [], `${table} leaked to an authenticated user`);

      await admin.from(table).delete().eq("ticker", "AAPL");
    });
  }
});

describe("anonymous access", () => {
  test("an unauthenticated client sees no watchlist rows", async () => {
    const anon = createClient(URL, PUBLISHABLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anon.from("watchlist_items").select("*");

    assert.equal(error, null);
    assert.deepEqual(data, [], "watchlist rows visible without authentication");
  });
});
