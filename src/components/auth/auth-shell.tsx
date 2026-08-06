import Link from "next/link";
import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/ui/footer";
import { RevealOnScroll } from "@/components/ui/reveal-on-scroll";

/**
 * Shared frame for /login and /signup so the two cannot drift apart. A narrow
 * column on the ground rather than a floating card, which would be the generic
 * SaaS login wearing dark paint.
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
    <>
      {/* Revealed on scroll rather than fixed in place: the form is the task,
          and a bar offering four ways to leave sits badly above the moment we
          are asking someone to stay. It comes down as soon as the page moves,
          and on focus for anyone arriving by keyboard. */}
      <RevealOnScroll>
        <Nav />
      </RevealOnScroll>

      <main className="flex min-h-screen flex-col justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-[24rem]">
        {/* Kept even though the nav carries the wordmark too. The nav is hidden
            on arrival, so without this the page has no route home at all until
            you scroll. */}
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
      <Footer />
    </>
  );
}

/** Avoids green: it carries price direction here, so info is gold. */
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
      // 1px rather than 2px: the thick coloured left bar is the category's
      // stock alert costume, and the copy already carries the meaning.
      className={`mb-6 border-l bg-[var(--raised)] px-3 py-2.5 text-sm leading-relaxed text-[var(--fg)] ${
        tone === "error" ? "border-[var(--down)]" : "border-[var(--gold)]"
      }`}
    >
      {children}
    </p>
  );
}
