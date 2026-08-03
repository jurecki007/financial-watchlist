import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getNews, FAILURE_COPY, type Article } from "@/lib/market-data";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/ui/footer";
import { Container } from "@/components/ui/shell";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";

export const metadata = { title: "News — Financial Watchlist" };

type Row = { ticker: string; company_name: string | null };
type Item = Article & { ticker: string };

/**
 * Headlines across everything the user watches.
 *
 * One Finnhub call per ticker, which is fine on a 60-per-minute allowance and
 * mostly served from news_cache's 30-minute TTL anyway. Issued in parallel:
 * sequentially, a twelve-company watchlist would take twelve round trips
 * before anything rendered.
 *
 * A per-ticker failure is swallowed rather than propagated. One company's news
 * being unavailable is not a reason to show nothing — the feed simply omits it,
 * and the count of sources that answered is reported honestly at the top.
 */
async function Feed({ rows }: { rows: Row[] }) {
  const results = await Promise.all(
    rows.map(async (r) => ({ ticker: r.ticker, res: await getNews(r.ticker) })),
  );

  const items: Item[] = [];
  const failures: string[] = [];
  for (const { ticker, res } of results) {
    if (res.ok) items.push(...res.data.map((a) => ({ ...a, ticker })));
    else failures.push(res.reason);
  }

  // Every source failed and there is nothing to show — that is a genuine error
  // state, unlike a partial failure which is just a shorter feed.
  if (items.length === 0 && failures.length > 0) {
    const copy = FAILURE_COPY[failures[0] as keyof typeof FAILURE_COPY];
    return <ErrorState title={copy.title} body={copy.body} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No coverage in the last two weeks"
        body="Nothing has been published about the companies you follow. Headlines appear here as they break."
      />
    );
  }

  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return (
    <>
      {failures.length > 0 && (
        <p className="mb-6 text-xs text-[var(--gold)]">
          {failures.length} of {rows.length} companies could not be reached;
          their headlines are missing from this list.
        </p>
      )}
      <ul className="space-y-0">
        {items.slice(0, 60).map((a) => (
          <li key={`${a.ticker}-${a.id}`} className="border-t border-[var(--rule)]">
            <div className="flex gap-4 py-4">
              {/* The ticker is the anchor: it says which company this is about
                  and doubles as the route to that company. */}
              <Link
                href={`/company/${encodeURIComponent(a.ticker)}`}
                className="w-16 shrink-0 pt-0.5 font-mono text-xs text-[var(--dim)] transition-colors hover:text-[var(--gold)]"
              >
                {a.ticker}
              </Link>
              <div className="min-w-0">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.95rem] leading-snug transition-colors hover:text-[var(--gold)]"
                >
                  {a.headline}
                </a>
                <p className="mt-1.5 font-mono text-[11px] text-[var(--faint)]">
                  {a.source} ·{" "}
                  {new Date(a.publishedAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                  })}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function NewsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("watchlist_items")
    .select("ticker, company_name")
    .order("added_at", { ascending: false });

  const rows = (data ?? []) as Row[];

  return (
    <>
      <Nav />
      <main className="min-h-screen py-10">
        <Container>
          <header>
            <h1 className="text-2xl font-medium tracking-tight">News</h1>
            <p className="mt-1.5 text-sm text-[var(--dim)]">
              {rows.length
                ? `Across the ${rows.length} ${rows.length === 1 ? "company" : "companies"} you follow`
                : "Headlines from the companies you follow"}
            </p>
          </header>

          <div className="mt-9">
            {rows.length === 0 ? (
              <EmptyState
                title="Nothing to report yet"
                body="Add companies to your watchlist and their headlines collect here."
                action={
                  <Link
                    href="/dashboard"
                    className="flex h-10 items-center bg-[var(--gold)] px-4 text-sm font-medium text-[var(--ground)] transition-opacity hover:opacity-90"
                  >
                    Go to watchlist
                  </Link>
                }
              />
            ) : (
              <Suspense
                fallback={
                  <div className="space-y-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex gap-4 border-t border-[var(--rule)] pt-4">
                        <Skeleton className="h-3 w-12 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="mt-2 h-3 w-32" />
                        </div>
                      </div>
                    ))}
                  </div>
                }
              >
                <Feed rows={rows} />
              </Suspense>
            )}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
