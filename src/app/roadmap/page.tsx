/**
 * THESIS: build progress as a settlement ledger, not a status dashboard. It
 * refuses the category default — a grid of phase cards with percentage rings.
 * A ledger is answerable: every line is either settled or it is not, and the
 * unsettled ones say what they are waiting on.
 *
 * OWN-WORLD: near-black ground, one metallic gold, hairline rules that fill to
 * their proportion like a tape. Mono for every numeral so fractions align down
 * a column; sans for prose. Green and red are reserved for price direction
 * elsewhere in this product, so state is carried by marker form — filled,
 * hollow, dash — and by weight, never by traffic-light colour.
 *
 * STORY: a reader learns what is built, what is not, and what the unbuilt work
 * is blocked on, without needing the repo.
 *
 * FIRST VIEWPORT: kicker, one-line thesis, then the aggregate as a mono
 * fraction above a full-measure rule that fills gold. Phase 1 begins in view.
 *
 * FORM: ledger; first on the ordered list; shaped directly rather than seeded,
 * as the surface is narrowly specified and inherits a committed world.
 */
import type { Metadata } from "next";
import { loadRoadmap, type Item, type Phase } from "@/lib/roadmap";
import { Nav } from "@/components/nav";

// Deliberately NOT force-static. The nav is session-aware, and a page
// prerendered at build time has no request to read identity or pathname from —
// a signed-in visitor was shown "Sign in". The roadmap content still comes
// from a file read, so rendering per request costs a filesystem hit, not a
// network one.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roadmap — Financial Watchlist",
  description:
    "What is built, what is not, and what the unbuilt work is waiting on.",
};

/** Marker shapes. State reads without colour, which colourblind users need
 *  and which keeps green/red free for price movement. */
function Marker({ state }: { state: Item["state"] }) {
  if (state === "shipped") {
    return (
      <span
        aria-hidden
        className="mt-[0.45rem] block size-[7px] shrink-0 bg-[var(--gold)]"
      />
    );
  }
  if (state === "blocked") {
    return (
      <span
        aria-hidden
        className="mt-[0.45rem] block size-[7px] shrink-0 border border-[var(--gold)]"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="mt-[0.72rem] block h-px w-[7px] shrink-0 bg-[var(--dim)]"
    />
  );
}

const STATE_LABEL: Record<Item["state"], string> = {
  shipped: "Shipped",
  blocked: "Blocked",
  pending: "Not started",
};

/** The tape: a hairline that fills to its proportion. The fill is the datum,
 *  so it renders at final width with no JS and only animates as an accent. */
function Tape({ ratio, delay = 0 }: { ratio: number; delay?: number }) {
  return (
    <div className="relative h-px w-full bg-[var(--rule)]">
      <div
        className="tape-fill absolute inset-y-0 left-0 bg-[var(--gold)]"
        style={{
          width: `${Math.round(ratio * 1000) / 10}%`,
          animationDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}

function Fraction({ done, total }: { done: number; total: number }) {
  return (
    <span className="font-mono text-sm tabular-nums text-[var(--dim)]">
      <span className={done === total ? "text-[var(--gold)]" : "text-[var(--fg)]"}>
        {String(done).padStart(2, "0")}
      </span>
      <span className="mx-1 opacity-50">/</span>
      {String(total).padStart(2, "0")}
    </span>
  );
}

function PhaseBlock({ phase, index }: { phase: Phase; index: number }) {
  return (
    <section className="pt-16 first:pt-10" aria-labelledby={`p${phase.number}`}>
      <div className="mb-3 flex items-baseline justify-between gap-6">
        <h2
          id={`p${phase.number}`}
          className="flex items-baseline gap-3 text-lg font-medium tracking-tight"
        >
          <span className="font-mono text-sm text-[var(--dim)]">
            {String(phase.number).padStart(2, "0")}
          </span>
          {phase.title}
        </h2>
        <Fraction done={phase.shipped} total={phase.total} />
      </div>

      <Tape ratio={phase.total ? phase.shipped / phase.total : 0} delay={index * 90} />

      <div className="mt-7 space-y-7">
        {phase.groups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <h3 className="mb-3 text-sm font-medium text-[var(--dim)]">
                {group.label}
              </h3>
            )}
            <ul className="space-y-2.5">
              {group.items.map((item, ii) => (
                <li key={ii} className="flex gap-3.5">
                  <Marker state={item.state} />
                  <p
                    className={
                      item.state === "shipped"
                        ? "text-[0.95rem] leading-relaxed break-words text-[var(--fg)]"
                        : "text-[0.95rem] leading-relaxed break-words text-[var(--dim)]"
                    }
                  >
                    <span className="sr-only">{STATE_LABEL[item.state]}: </span>
                    {item.text}
                    {item.note && (
                      <span className="text-[var(--dim)]">
                        {" — "}
                        <span
                          className={
                            item.state === "blocked"
                              ? "text-[var(--gold)]"
                              : undefined
                          }
                        >
                          {item.note}
                        </span>
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function RoadmapPage() {
  let roadmap;
  try {
    roadmap = loadRoadmap();
  } catch {
    roadmap = null;
  }

  // Error state. This page is generated from a file that could move or be
  // rewritten; failing to a blank page would look like "nothing is built".
  if (!roadmap || roadmap.total === 0) {
    return (
      <main className="roadmap mx-auto flex min-h-screen max-w-[46rem] flex-col justify-center px-6">
        <p className="font-mono text-sm text-[var(--gold)]">Roadmap unavailable</p>
        <p className="mt-3 text-[0.95rem] leading-relaxed break-words text-[var(--dim)]">
          This page is generated from <code>ROADMAP.md</code> at build time and
          that file could not be read. The roadmap itself is still in the
          repository.
        </p>
        <a
          className="mt-6 w-fit border-b border-[var(--gold)] pb-0.5 text-sm text-[var(--gold)] transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)]"
          href="https://github.com/jurecki007/financial-watchlist/blob/main/ROADMAP.md"
        >
          Read it on GitHub
        </a>
      </main>
    );
  }

  const pct = Math.round((roadmap.shipped / roadmap.total) * 100);

  return (
    <>
      <Nav />
      <main className="roadmap min-h-screen px-6 pb-32">
      <div className="mx-auto max-w-[46rem]">
        <header className="pt-14">
          <h1 className=" text-balance text-3xl leading-[1.2] font-medium tracking-tight sm:text-[2.5rem]">
            What is built, what is not, and what the rest is waiting on.
          </h1>
          <p className="mt-5 max-w-[38rem] text-[0.95rem] leading-relaxed break-words text-[var(--dim)]">
            Generated from the repository&rsquo;s roadmap file at build time, so
            this page cannot drift from the work. Every line below is either
            settled or says what it needs.
          </p>

          <div className="mt-12 flex items-baseline justify-between gap-6">
            <p className="font-mono text-sm text-[var(--dim)]">
              <span className="text-[var(--fg)]">{roadmap.shipped}</span> of{" "}
              {roadmap.total} shipped
            </p>
            <p className="font-mono text-sm tabular-nums text-[var(--gold)]">
              {pct}%
            </p>
          </div>
          <div className="mt-3">
            <Tape ratio={roadmap.shipped / roadmap.total} />
          </div>
        </header>

        <div className="divide-y divide-[var(--rule)]">
          {roadmap.phases.map((phase, i) => (
            <PhaseBlock key={phase.number} phase={phase} index={i} />
          ))}
        </div>

        {roadmap.next.length > 0 && (
          <section className="mt-20 border-t border-[var(--rule)] pt-10">
            <h2 className="text-lg font-medium tracking-tight">
              Beyond the core build
            </h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed break-words text-[var(--dim)]">
              Extensions considered once the product above is complete.
            </p>
            <ul className="mt-6 space-y-2.5">
              {roadmap.next.map((addon, i) => (
                <li key={i} className="flex gap-3.5">
                  <Marker state={addon.done ? "shipped" : "pending"} />
                  <p
                    className={
                      addon.done
                        ? "text-[0.95rem] leading-relaxed break-words text-[var(--fg)]"
                        : "text-[0.95rem] leading-relaxed break-words text-[var(--dim)]"
                    }
                  >
                    <span className="sr-only">
                      {addon.done ? "Shipped: " : "Not started: "}
                    </span>
                    {addon.name}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-20 border-t border-[var(--rule)] pt-8">
          <a
            className="text-sm text-[var(--dim)] transition-colors hover:text-[var(--gold)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)]"
            href="https://github.com/jurecki007/financial-watchlist"
          >
            Source on GitHub
          </a>
        </footer>
      </div>
      </main>
    </>
  );
}
