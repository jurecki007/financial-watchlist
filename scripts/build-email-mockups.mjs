/**
 * Renders every outbound email so it can be opened in a browser without sending
 * anything. Generated, never hand-written — a hand-kept copy silently stops
 * matching the email it claims to show.
 *
 * Byte-faithful: the only substitutions are the template variables.
 *
 * Usage: npm run mockups
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// public/, so Next serves these verbatim and /about/project can frame them.
// Reading a path outside public/ from a server component would depend on
// output file tracing noticing it — a build that works locally and 404s live.
const OUT = "public/mockups/emails";
const TEMPLATES = "supabase/templates";
const ALERT_FN = "supabase/functions/check-price-alerts/index.ts";
const APP_URL = "https://financial-demo.nyxiontech.com";
const PROJECT = "https://fsboxdlbncegnhcjniaf.supabase.co";

// Deliberately implausible: a credential-shaped string here trains the secret
// scanners to be ignored.
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
 * The alert email lives in a Deno function that reads `Deno.env` at load, so
 * there is no module Node can import. Slicing the builder out keeps one source
 * of truth; the markers are load-bearing, so a rename fails loudly here rather
 * than emitting a stale mockup.
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
