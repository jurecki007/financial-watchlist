import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared frame for /login and /signup so the two cannot drift apart.
 *
 * A single narrow column on the ground rather than a card floating on a
 * backdrop — the market-native register is flat and instrument-like, and a
 * raised card here would be the generic SaaS login wearing dark paint.
 */
export function AuthShell({
  title,
  lede,
  children,
  footer,
}: {
  title: string;
  lede: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-[24rem]">
        <Link
          href="/"
          className="font-mono text-xs tracking-[0.18em] text-[var(--dim)] uppercase transition-colors hover:text-[var(--gold)]"
        >
          Financial Watchlist
        </Link>

        <h1 className="mt-6 text-[1.75rem] leading-tight font-medium tracking-tight">
          {title}
        </h1>
        <p className="mt-2.5 mb-8 text-[0.95rem] leading-relaxed text-[var(--dim)]">
          {lede}
        </p>

        {children}

        <p className="mt-8 border-t border-[var(--rule)] pt-6 text-sm text-[var(--dim)]">
          {footer}
        </p>
      </div>
    </main>
  );
}

/**
 * Inline notice. Tones deliberately avoid green — green and red carry price
 * direction in this product, so an "info" notice uses gold and only genuine
 * failure borrows red.
 */
export function Notice({
  tone,
  children,
}: {
  tone: "info" | "error";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`mb-6 border-l-2 bg-[var(--raised)] px-3 py-2.5 text-sm leading-relaxed text-[var(--fg)] ${
        tone === "error" ? "border-[var(--down)]" : "border-[var(--gold)]"
      }`}
    >
      {children}
    </p>
  );
}
