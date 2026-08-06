import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/shell";

export const metadata: Metadata = {
  title: "The project — Financial Watchlist",
  description:
    "The stack, the two market-data providers and why there are two, and the decisions behind the architecture.",
  alternates: { canonical: "/about/project" },
};

/**
 * What this is and how it was built, for someone evaluating the work.
 *
 * Read mode: the visitor is here to understand, so prose is measure-capped and
 * every claim is specific. Numbers are the point — "rate limited" says nothing,
 * "8 requests a minute, which is why the dashboard batches" says what the
 * constraint was and what it forced.
 */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[var(--rule)] pt-8">
      <h2 className="mb-5 font-mono text-xs tracking-[0.18em] text-[var(--dim)] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Prose column. Capped separately from the grids, which want the full width. */
function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[58ch] text-base leading-relaxed text-[var(--dim)]">
      {children}
    </p>
  );
}

/**
 * One email, framed as it actually renders.
 *
 * An iframe rather than a screenshot: a PNG would be another artefact to keep
 * in step with the templates, and the first time it fell behind, this page
 * would be showing a reviewer an email the app no longer sends. The files under
 * public/mockups/ are regenerated from the templates by `npm run mockups`, so
 * the page can only ever show what is really sent.
 *
 * `sandbox=""` applies every restriction: no scripts, no navigation, no forms.
 * The emails contain no script, and a preview whose call to action navigates
 * the reviewer away is not a preview. `loading="lazy"` keeps four documents
 * from being fetched by anyone who never scrolls this far.
 */
function EmailPreview({
  title,
  note,
  src,
  heightClass,
  textSrc,
}: {
  title: string;
  note: string;
  src: string;
  /**
   * Fixed, and responsive, because the frame cannot measure its own contents:
   * `sandbox=""` denies same-origin access, which is the point of it. Heights
   * were measured from the real documents at 360 / 500 / 760px, where each
   * email grows about 10% as it narrows and the text rewraps.
   *
   * Deliberately biased generous. Surplus height is invisible — the email's
   * own background is the same `--ground` as the page behind it — whereas a
   * few pixels short puts a scrollbar inside a preview.
   */
  heightClass: string;
  /** The text/plain alternative, where the message has one. */
  textSrc?: string;
}) {
  return (
    <figure className="m-0">
      <figcaption className="mb-2.5">
        <span className="font-mono text-sm text-[var(--gold)]">{title}</span>
        <span className="mt-1 block max-w-[60ch] text-sm leading-relaxed text-[var(--dim)]">
          {note}
        </span>
      </figcaption>

      <div className="border border-[var(--rule)]">
        <iframe
          src={src}
          title={`${title}, as the email renders`}
          loading="lazy"
          sandbox=""
          className={`block w-full bg-[var(--ground)] ${heightClass}`}
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-5 text-xs">
        <a
          href={src}
          className="font-mono text-[var(--dim)] transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)]"
        >
          open full size
        </a>
        {textSrc ? (
          <a
            href={textSrc}
            className="font-mono text-[var(--dim)] transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)]"
          >
            plain-text version
          </a>
        ) : null}
      </div>
    </figure>
  );
}

function Row({
  name,
  role,
  note,
}: {
  name: string;
  role: string;
  note?: string;
}) {
  return (
    <div className="grid gap-x-6 gap-y-1 border-t border-[var(--rule)] py-3.5 sm:grid-cols-[11rem_1fr]">
      <div className="font-mono text-sm">{name}</div>
      <div>
        <span className="text-sm">{role}</span>
        {note && (
          <span className="mt-0.5 block max-w-[52ch] text-sm text-[var(--dim)]">
            {note}
          </span>
        )}
      </div>
    </div>
  );
}

/** One table. Columns in mono because they are identifiers, not prose. */
function Table({
  name,
  columns,
  note,
}: {
  name: string;
  columns: [string, string][];
  note?: string;
}) {
  return (
    <div className="border-t border-[var(--rule)] py-5">
      <h3 className="font-mono text-sm text-[var(--gold)]">{name}</h3>
      <dl className="mt-2.5 grid gap-x-6 gap-y-1 sm:grid-cols-[13rem_1fr]">
        {columns.map(([col, type]) => (
          <Fragment key={col}>
            <dt className="font-mono text-xs">{col}</dt>
            <dd className="font-mono text-xs text-[var(--dim)]">{type}</dd>
          </Fragment>
        ))}
      </dl>
      {note && (
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-[var(--dim)]">
          {note}
        </p>
      )}
    </div>
  );
}

/** A decision worth defending, stated as the constraint then the consequence. */
function Decision({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-[62ch]">
      <h3 className="text-[0.95rem] font-medium">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
        {children}
      </p>
    </div>
  );
}

export default function ProjectPage() {
  return (
    <Container>
      <header className="mb-10">
        <h1 className="text-3xl font-medium tracking-tight">
          What this is, and how it works
        </h1>
        <p className="mt-3 max-w-[58ch] text-base leading-relaxed text-[var(--dim)]">
          A financial watchlist: sign up, search for a company, add it, and get
          live prices, a candlestick chart, fundamentals, news and price alerts
          that arrive by email. Built to be read as much as clicked through —
          the interesting parts are the constraints and what they forced.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <a
            href="https://github.com/jurecki007/financial-watchlist"
            className="text-[var(--gold)] transition-opacity hover:opacity-80"
          >
            Source on GitHub
          </a>
          <Link
            href="/roadmap"
            className="text-[var(--gold)] transition-opacity hover:opacity-80"
          >
            Roadmap and what is not built
          </Link>
        </div>
      </header>

      <div className="space-y-12">
        <Section title="Stack">
          <div>
            <Row name="Next.js 15" role="App Router, React server components" note="Server components by default; client components only where interaction requires it — charts, forms, the search input." />
            <Row name="TypeScript" role="Strict mode" />
            <Row name="Tailwind CSS v4" role="Styling, themed with CSS custom properties" note="One token set, two themes. Light is a purpose-built palette, not an inversion of the dark one." />
            <Row name="lightweight-charts" role="TradingView's open-source charting library" note="Not Recharts. Candlesticks, crosshair and time-scale behaviour are what it exists for." />
            <Row name="Supabase" role="Postgres, Auth, Edge Functions" note="Email/password and Google OAuth. Schema and row-level security ship as SQL migrations, not dashboard clicks." />
            <Row name="Twelve Data" role="Quotes, historical candles, symbol search" />
            <Row name="Finnhub" role="Company news and fundamentals" />
            <Row name="Resend" role="Alert emails, sent from a scheduled function" />
            <Row name="Vercel + Cloudflare" role="Hosting and DNS" note="Cloudflare is DNS-only on purpose — proxying in front of Vercel double-CDNs the traffic and interferes with certificate management." />
          </div>
        </Section>

        <Section title="Two data providers, and why">
          <P>
            Neither free tier covers the whole surface, so the app uses both and
            hides that fact from everything above the data layer.
          </P>
          <div className="mt-6">
            <Row
              name="Twelve Data"
              role="800 credits/day · 8 requests/min"
              note="Real-time quotes, historical OHLC for the chart, and symbol search. The 8/min ceiling is the binding constraint on the whole app."
            />
            <Row
              name="Finnhub"
              role="60 requests/min · US markets"
              note="Company news and fundamentals — market cap, P/E, 52-week range. Its historical-candle endpoint is paywalled and returns 403 on a free key, which is precisely why Twelve Data keeps the chart."
            />
          </div>
          <div className="mt-6 space-y-5">
            <Decision title="One interface, swappable vendors">
              Callers import <code className="font-mono text-[0.9em] text-[var(--fg)]">getQuote</code>,{" "}
              <code className="font-mono text-[0.9em] text-[var(--fg)]">getCandles</code>,{" "}
              <code className="font-mono text-[0.9em] text-[var(--fg)]">getNews</code> and friends from one
              module and never learn which vendor answered. Vendor-specific code
              is isolated in a providers directory. That seam has already earned
              itself once: the chart moved from Finnhub to Twelve Data when the
              paywall was discovered, and nothing outside the data layer changed.
            </Decision>
            <Decision title="The browser never talks to a provider">
              Every external call runs server-side, so the API keys never reach
              the client and responses can be cached and rate-limited centrally.
              The two routes the browser can call are authenticated and bounded —
              an open proxy to a metered API is somebody else&rsquo;s free tier.
            </Decision>
            <Decision title="Batching, because 8/min is the real limit">
              A dashboard with twelve companies makes one request, not twelve:
              the tickers go out as a single comma-separated quote call. Chart
              history is billed per request rather than per bar, so a page of 750
              candles costs exactly what 180 would — meaning depth is a payload
              decision, not a budget one.
            </Decision>
          </div>
        </Section>

        <Section title="When a provider fails">
          <P>
            Free tiers fail routinely, so failure is a value rather than an
            exception. The data layer never throws; it returns either data or one
            of five reasons, and every surface maps those to copy that says
            something true.
          </P>
          <div className="mt-6">
            <Row name="rate_limited" role="429, or the daily budget is spent" note="Recovers on its own. Raises one toast per cause, not one per card." />
            <Row name="unavailable" role="5xx, timeout, network failure" note="Theirs, not ours. Offers a retry." />
            <Row name="not_entitled" role="403 — the free plan does not include it" />
            <Row name="misconfigured" role="401, or the key is missing entirely" note="Ours. Split out from not_entitled after a deployment with no key told every visitor the data sat behind a paid plan — a configuration fault presented as a product decision." />
            <Row name="not_found" role="No such symbol" />
          </div>
          <div className="mt-6 space-y-5">
            <Decision title="Stale beats empty">
              Quotes and news are cached in Postgres. If a refresh fails and a
              cached value exists, the page renders the cached number with a
              visible <span className="font-mono text-[0.9em] text-[var(--fg)]">as of 14:32</span> badge instead of an
              error. A slightly old price is a far better answer than a broken
              card, and the badge is what keeps that honest.
            </Decision>
            <Decision title="Vendor internals stay on the server">
              Raw provider messages, status bodies and URLs are logged
              server-side only — some providers echo the query string, which
              carries the key. The browser sees mapped copy and nothing else.
            </Decision>
          </div>
        </Section>

        <Section title="Data model">
          <P>
            Five tables. The interesting parts are the constraints — most of
            what could go wrong here is enforced by Postgres rather than
            checked in application code, because an application check races and
            a constraint does not.
          </P>
          <div className="mt-6">
            <Table
              name="profiles"
              columns={[
                ["id", "uuid pk → auth.users, on delete cascade"],
                ["display_name", "text"],
                ["created_at", "timestamptz not null default now()"],
              ]}
              note="Created by a Postgres trigger on auth.users insert, never from the client. A client-created profile row is a row that may not exist — the trigger makes it an invariant instead of a hopeful sequence of two calls."
            />
            <Table
              name="watchlist_items"
              columns={[
                ["id", "uuid pk"],
                ["user_id", "uuid → auth.users, on delete cascade"],
                ["ticker", "text, upper-case + length checks"],
                ["company_name", "text"],
                ["added_at", "timestamptz not null default now()"],
                ["unique", "(user_id, ticker)"],
              ]}
              note="The uniqueness of a company per user lives in the database rather than in a check-before-insert, which races under concurrent requests. Tickers are stored upper-case and constrained to be — without that, 'aapl' and 'AAPL' are different rows and the unique constraint silently stops doing its job."
            />
            <Table
              name="price_alerts"
              columns={[
                ["id", "uuid pk"],
                ["user_id", "uuid → auth.users, on delete cascade"],
                ["ticker", "text, upper-case + length checks"],
                ["condition", "enum: above | below"],
                ["threshold", "numeric(20,6), check > 0"],
                ["triggered_at", "timestamptz"],
                ["active", "boolean not null default true"],
                ["created_at", "timestamptz not null default now()"],
              ]}
              note="threshold is numeric, not a float. Money compared with >= under binary floating point fires at the wrong number, and an alert that triggers a cent early is a bug a user notices immediately."
            />
            <Table
              name="quote_cache · news_cache"
              columns={[
                ["ticker", "text pk"],
                ["quote_json / article_json", "jsonb not null"],
                ["fetched_at", "timestamptz not null default now()"],
              ]}
              note="Row-level security is enabled on both with zero policies, which makes them unreachable from the browser entirely — only the server, holding the secret key, can read them. A client able to read quote_cache could enumerate every ticker the whole user base follows."
            />
          </div>
        </Section>

        <Section title="Security">
          <P>
            The database is the boundary, not the interface. Every table holding
            per-user data has row-level security enabled with a policy of{" "}
            <code className="font-mono text-[0.9em] text-[var(--fg)]">user_id = auth.uid()</code>, so queries
            carry no ownership clause at all — Postgres decides what a session
            may see. A cross-user isolation suite proves it by trying.
          </P>
          <div className="mt-6">
            <Row name="Cache tables" role="RLS on, zero policies" note="Unreachable from the browser entirely. A client able to read the quote cache could enumerate every ticker the whole user base follows." />
            <Row name="Auth gate" role="Middleware, not per-component" note="Unauthenticated requests never reach a dashboard route in the first place." />
            <Row name="Post-login redirect" role="Sanitised" note="An open redirect here is a phishing primitive — it bounces a user off-site at the moment they have just typed a password." />
            <Row name="Response headers" role="HSTS, X-Frame-Options, Referrer-Policy, and more" note="Referrer-Policy is the load-bearing one: a full-URL referrer would leak routes like /company/AAPL to linked-out news publishers, disclosing a private watchlist." />
            <Row name="CI" role="Four checks on every pull request" note="Full-history secret scan, environment-variable guard, semgrep static analysis, dependency audit. main is protected; nothing lands without them." />
          </div>
        </Section>

        <Section title="Testing">
          <P>
            Guards get tested by being given something they should catch. The
            JSON-LD escape is handed a real{" "}
            <code className="font-mono text-[0.9em] text-[var(--fg)]">&lt;/script&gt;</code> breakout; the auth
            gate is probed with path traversal; the chart&rsquo;s scroll-paging test
            was rewritten twice after it was caught passing against a
            deliberately broken build.
          </P>
          <div className="mt-6">
            <Row name="Unit" role="Error classification, caching, routing policy, structured data" />
            <Row name="End to end" role="Playwright, against the production bundle" note="Not the dev server — streaming, caching and middleware behave differently enough that a passing dev-mode test says less than it appears to." />
            <Row name="Database" role="Cross-user RLS isolation" />
          </div>
        </Section>

        <Section title="Performance and loading">
          <P>
            Perceived speed is treated as a design surface. The shell streams
            immediately and each unit of data suspends on its own, so one
            rate-limited ticker cannot hold up eleven others.
          </P>
          <div className="mt-6 space-y-5">
            <Decision title="A skeleton means we have nothing, and usually we have something">
              Cache-first means a returning visitor&rsquo;s prices are already
              known and paint instantly. Skeletons are for genuine cold loads,
              they wait before appearing so a fast response beats them entirely,
              and they hold a minimum once shown — a placeholder that flashes for
              80ms reads as a glitch rather than as speed.
            </Decision>
            <Decision title="Placeholder timing, not just placeholders">
              A skeleton waits before appearing, so a response that beats it is
              never interrupted by one, and holds a minimum once shown. A
              placeholder that flashes for 80ms reads as a glitch rather than as
              speed.
            </Decision>
            <Decision title="The hero chart is its own loading state">
              The landing page draws a gold candlestick chart in over four
              seconds from a committed fixture rather than a live call — the
              highest-traffic route is the least defensible place to spend a
              daily budget, and it means the first thing anyone sees can never be
              an error. Reduced-motion gets the finished chart immediately, not a
              degraded one.
            </Decision>
          </div>
        </Section>

        <Section title="Emails">
          <div className="space-y-5">
            <P>
              Three messages leave the app: a price alert when a threshold is
              crossed, and the signup and password-reset mails. Each one is
              below, rendered from the same source that sends it &mdash; so this
              page cannot drift from the inbox, and nothing has to be triggered
              to be reviewed.
            </P>
            <P>
              They are built to email&rsquo;s constraints rather than the
              web&rsquo;s: tables for layout because Outlook renders with Word,
              styles inlined because Gmail drops a stylesheet, and each button
              doubled as VML so it survives both. Every alert also carries a
              plain-text alternative.
            </P>
          </div>

          {/* Generous gap between previews, not decoration: each frame's
              caption sits above it and its two links below, so the space
              between one email and the next has to beat the space inside a
              group or the links read as belonging to the wrong email. */}
          <div className="mt-7 space-y-14">
            <EmailPreview
              title="Price alert — crossed upward"
              note="Teal, ▲, and the word “risen”: direction never rests on colour alone."
              src="/mockups/emails/alert-above.html"
              heightClass="h-[540px] lg:h-[490px]"
              textSrc="/mockups/emails/alert-above.txt"
            />
            <EmailPreview
              title="Price alert — crossed downward"
              note="The same message inverted. Both are kept because neither is an example of the other."
              src="/mockups/emails/alert-below.html"
              heightClass="h-[540px] lg:h-[490px]"
              textSrc="/mockups/emails/alert-below.txt"
            />
            <EmailPreview
              title="Confirm your email"
              note="Sent on signup. The pasteable link is full-strength gold, not a dimmed variant — it is the path that has to work once a filter strips the button."
              src="/mockups/emails/confirmation.html"
              heightClass="h-[650px] lg:h-[565px]"
            />
            <EmailPreview
              title="Reset your password"
              note="Says plainly that nothing has changed yet, because the most common reader of a reset mail did not ask for one."
              src="/mockups/emails/recovery.html"
              heightClass="h-[650px] lg:h-[565px]"
            />
          </div>
        </Section>

        <Section title="How it ships">
          <P>
            Nothing reaches production by being pushed. The repository is
            public, so the cost of a mistake is asymmetric — a leaked key on a
            public repo is burned the moment it is committed, whether or not
            anyone noticed. The process is built around that.
          </P>

          <div className="mt-6">
            <Row
              name="1 · pre-commit"
              role="Local secret scan, before the commit exists"
              note="This is the layer that actually matters. CI tells you a key leaked; the hook stops it leaking. Catching it in CI and force-pushing still means the key is burned and has to be rotated."
            />
            <Row
              name="2 · branch"
              role="main is protected and rejects a direct push"
              note="Enforced for administrators too, so there is no path that quietly skips the rest of this list."
            />
            <Row
              name="3 · pull request"
              role="Four required checks, all must pass"
            />
            <Row
              name="4 · rebase merge"
              role="Linear history, no merge commits"
              note="The history is part of what a reader is evaluating, so it is kept readable on purpose."
            />
          </div>

          <h3 className="mt-8 mb-4 font-mono text-xs tracking-[0.18em] text-[var(--dim)] uppercase">
            The four checks
          </h3>
          <div>
            <Row
              name="Secret scan"
              role="gitleaks, full history"
              note="Every commit ever made, not just the diff — a key introduced and later deleted is still in the history and still compromised."
            />
            <Row
              name="Env var guard"
              role="Custom script"
              note="Refuses tracked .env files, values committed into .env.example, and credential-shaped strings anywhere in tracked files. It was itself tested by being handed things it should catch — that method found three fail-open defects in these scripts that reading them had missed."
            />
            <Row
              name="OWASP / static analysis"
              role="semgrep, OWASP Top 10 plus JS/TS and secrets rulesets"
            />
            <Row
              name="Dependency audit"
              role="npm audit, high severity and above"
            />
          </div>

          <div className="mt-8 space-y-5">
            <Decision title="Third-party actions are pinned to commit SHAs">
              Not to a tag. A tag is mutable, so pinning to one means the
              security pipeline runs whatever that tag points at today — which
              is the supply-chain attack the pipeline exists to catch.
            </Decision>
            <Decision title="Schema changes ship as SQL migrations">
              Row-level security policies are committed as migrations rather
              than clicked into a dashboard. A policy that exists only in a
              hosted console cannot be reviewed, cannot be diffed, and cannot be
              rebuilt from the repository — and the migration history is part of
              the project&rsquo;s account of itself.
            </Decision>
            <Decision title="Documentation moves in the same commit as the code">
              The roadmap, the README and the project&rsquo;s own instructions
              are treated as deliverables rather than notes about them. An
              unticked box beside working code reads as abandoned; a ticked box
              beside nothing reads as dishonest. Neither is recoverable by a
              later cleanup commit, because the history is visible.
            </Decision>
          </div>
        </Section>
      </div>
    </Container>
  );
}
