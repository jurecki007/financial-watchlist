import Link from "next/link";
import { Container } from "@/components/ui/shell";

/**
 * Shared footer. Kept to what is true — the stack, the source, the roadmap —
 * with no invented links to a privacy policy or support desk that do not exist.
 */
export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--rule)] py-8">
      <Container className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <p className="text-xs leading-relaxed text-[var(--faint)]">
          Next.js and Supabase · quotes and charts from Twelve Data · news and
          fundamentals from Finnhub · charts by TradingView
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <Link
            href="/about/project"
            className="text-[var(--dim)] transition-colors hover:text-[var(--gold)]"
          >
            The project
          </Link>
          <Link
            href="/about/author"
            className="text-[var(--dim)] transition-colors hover:text-[var(--gold)]"
          >
            The author
          </Link>
          <Link
            href="/roadmap"
            className="text-[var(--dim)] transition-colors hover:text-[var(--gold)]"
          >
            Roadmap
          </Link>
          <a
            href="https://github.com/jurecki007/financial-watchlist"
            className="text-[var(--dim)] transition-colors hover:text-[var(--gold)]"
          >
            Source
          </a>
        </nav>
      </Container>
    </footer>
  );
}
