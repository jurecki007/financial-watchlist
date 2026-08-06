/**
 * Renders every outbound email into mockups/emails/ so they can be opened in a
 * browser without sending anything.
 *
 * These are generated, never hand-written. A hand-kept copy of an email is a
 * copy that silently stops matching the email — the same drift CLAUDE.md warns
 * about for the docs, and worse here, because a mockup is the artefact people
 * trust when they are deciding whether the real thing looks right.
 *
 * The output is byte-faithful to what actually gets sent: no banner, no
 * "this is a preview" chrome. The only substitutions are the template
 * variables, and they are filled with values that are obviously examples.
 *
 * Usage: npm run mockups
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = "mockups/emails";
const TEMPLATES = "supabase/templates";
const ALERT_FN = "supabase/functions/check-price-alerts/index.ts";
const APP_URL = "https://financial-demo.nyxiontech.com";
const PROJECT = "https://fsboxdlbncegnhcjniaf.supabase.co";

// Deliberately not a plausible token. A mockup that carries a credential-shaped
// string trains the secret scanners to be ignored, and invites someone to try
// clicking it.
const fakeUrl = (type) =>
  `${PROJECT}/auth/v1/verify?token=EXAMPLE_NOT_A_REAL_TOKEN&type=${type}` +
  `&redirect_to=${APP_URL}/auth/callback`;

/** GoTrue's Go-template variables, filled the way GoTrue would fill them. */
function renderAuthTemplate(file, type) {
  return readFileSync(join(TEMPLATES, file), "utf8")
    .replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, fakeUrl(type))
    .replace(/\{\{\s*\.Email\s*\}\}/g, "you@example.com");
}

/**
 * The alert email is a template literal inside a Deno function, so there is no
 * module Node can import — it reads `Deno.env` at load and starts a server.
 * Slicing the builder out and evaluating it keeps one source of truth without
 * restructuring the function to suit a mockup script.
 *
 * The markers are load-bearing, so a rename fails here loudly rather than
 * quietly emitting a stale mockup.
 */
function loadAlertBuilder() {
  const src = readFileSync(ALERT_FN, "utf8");
  const start = src.indexOf("const esc =");
  const end = src.indexOf("Deno.serve");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      `Could not find the email builder in ${ALERT_FN}. This script slices it ` +
        `out between "const esc =" and "Deno.serve" — if either moved or was ` +
        `renamed, update the markers here.`,
    );
  }

  const body = src
    .slice(start, end)
    .replace(/\(s: string\)/g, "(s)")
    .replace(/\(n: number\)/g, "(n)")
    .replace(/\(a: Alert, price: number\)/g, "(a, price)");

  return new Function("APP_URL", `${body}; return email;`)(APP_URL);
}

mkdirSync(OUT, { recursive: true });

const written = [];
const write = (name, contents) => {
  writeFileSync(join(OUT, name), contents);
  written.push(`${name} (${contents.length.toLocaleString()} bytes)`);
};

write("confirmation.html", renderAuthTemplate("confirmation.html", "signup"));
write("recovery.html", renderAuthTemplate("recovery.html", "recovery"));

const buildAlert = loadAlertBuilder();

// Both directions, because the colour, the arrow and the wording all change
// with the condition — one of them is not an example of the other.
const above = buildAlert(
  { ticker: "NVDA", condition: "above", threshold: 250 },
  263.87,
);
const below = buildAlert(
  { ticker: "AAPL", condition: "below", threshold: 180.5 },
  180.12,
);

write("alert-above.html", above.html);
write("alert-below.html", below.html);

// The text/plain alternative is part of the message, not a by-product, so it
// gets shown too — it is the version a watch or a screen reader renders.
write("alert-above.txt", above.text);
write("alert-below.txt", below.text);

console.log(`Wrote ${written.length} files to ${OUT}/`);
for (const w of written) console.log(`  ${w}`);
