import Link from "next/link";
import { Container } from "@/components/ui/shell";

/**
 * Shared footer.
 *
 * The landing page had one and every signed-in page had none, so the app
 * simply stopped at the last card with no edge — which reads as an unfinished
 * page rather than a deliberate end.
 *
 * Kept to what is true: the stack, the source, the roadmap. No invented links
 * to a privacy policy or support desk that do not exist.
 */
export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--rule)] py-8">
      <Container className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <p className="text-xs leading-relaxed text-[var(--faint)]">
          Next.js and Supabase · quotes and charts from Twelve Data · news and
          fundamentals from Finnhub · charts by TradingView
        </p>
        <nav aria-label="Footer" className="flex gap-6 text-xs">
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
