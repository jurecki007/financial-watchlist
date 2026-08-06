# Email mockups

Every email this app sends, rendered exactly as it goes out. Open any `.html`
here, or read them in place on **/about/project**, which frames them so a
reviewer can see all four without triggering a send.

These files are **generated, not maintained** — regenerate with:

```bash
npm run mockups
```

| File | Source | Sent by |
|---|---|---|
| `confirmation.html` | `supabase/templates/confirmation.html` | GoTrue, on signup |
| `recovery.html` | `supabase/templates/recovery.html` | GoTrue, on password reset |
| `alert-above.html` / `.txt` | `supabase/functions/check-price-alerts/index.ts` | Resend, threshold crossed upward |
| `alert-below.html` / `.txt` | same | Resend, downward |

They live under `public/` because Next serves that directory verbatim, which is
what lets the about page frame them. It also avoids a server component reading
a path outside `public/` and depending on Next's output file tracing having
noticed it — a build that works locally and 404s in production.

Both alert directions are kept because the arrow, the colour and the wording all
change with the condition; neither is an example of the other. The `.txt` files
are the real `text/plain` alternative — what a watch or a screen reader in
plain-text mode renders.

Two things to know when reading them:

**They are byte-faithful.** No preview banner, no injected chrome. The only
substitution is the template variables, filled with obvious placeholders
(`you@example.com`, `EXAMPLE_NOT_A_REAL_TOKEN`).

**A browser is not an email client.** These settle copy, hierarchy, colour and
contrast. They cannot tell you how Outlook's Word renderer treats the VML
buttons, or what Gmail does after stripping `<style>`.
