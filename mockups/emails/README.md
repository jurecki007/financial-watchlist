# Email mockups

Open any `.html` here in a browser to see an email exactly as it is sent. These
files are **generated, not maintained** — regenerate them with:

```bash
npm run mockups
```

| File | Source | Sent by |
|---|---|---|
| `confirmation.html` | `supabase/templates/confirmation.html` | GoTrue, on signup |
| `recovery.html` | `supabase/templates/recovery.html` | GoTrue, on password reset |
| `alert-above.html` / `.txt` | `supabase/functions/check-price-alerts/index.ts` | Resend, when a threshold is crossed upward |
| `alert-below.html` / `.txt` | same | Resend, downward |

Both alert directions are kept because the arrow, the colour and the wording all
change with the condition — neither is an example of the other. The `.txt` files
are the real `text/plain` alternative, which is what a watch or a screen reader
in plain-text mode renders.

Two things to know when reading them:

**They are byte-faithful.** No preview banner, no injected chrome. The only
substitution is the template variables, filled with obvious placeholders
(`you@example.com`, `EXAMPLE_NOT_A_REAL_TOKEN`).

**A browser is not an email client.** These confirm copy, hierarchy, colour and
contrast. They cannot confirm how Outlook's Word renderer treats the VML
buttons, or what Gmail does after stripping `<style>` — only a real send to a
real client shows that.
