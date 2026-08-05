import Link from "next/link";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { Container } from "@/components/ui/shell";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * THESIS: instrument chrome, not a website header. It refuses the category
 * default — a floating rounded pill with a centred logo — because this app is
 * a tool people keep open, and a bar that draws attention to itself every time
 * they glance up is a tax.
 *
 * OWN-WORLD: hairline rule on the near-black ground, mono wordmark tracked
 * wide, gold reserved for the route you are on. Nothing raised, nothing
 * floating, no shadow.
 *
 * STORY: the visitor always knows where they are and can always reach the
 * other two places.
 *
 * FIRST VIEWPORT: wordmark left, links beside it, identity right, one hairline
 * beneath. 52px tall.
 *
 * FORM: fixed top bar, first on the ordered list; shaped directly rather than
 * seeded, as this extends an established surface.
 */

type NavLink = {
  href: string;
  label: string;
  /**
   * Yields below `sm`. Only for destinations the footer also carries, so
   * hiding one removes a shortcut rather than the only way there.
   */
  yieldsOnMobile?: boolean;
};

// About is one entry, not two. It opens onto its own two-tab bar — six items
// here would have meant hiding half of them below `sm`, and the two pages are
// a pair a reader moves between rather than two unrelated destinations.
// Signed in, the three app destinations hold the bar at every width and the
// two reference ones yield below `sm`. Adding About without this overflowed
// /dashboard by 19px at 375px — four links plus a wordmark, theme toggle,
// account mark and sign-out is simply more than the width holds.
const SIGNED_IN: NavLink[] = [
  { href: "/dashboard", label: "Watchlist" },
  { href: "/news", label: "News" },
  { href: "/alerts", label: "Alerts" },
  { href: "/about", label: "About", yieldsOnMobile: true },
  { href: "/roadmap", label: "Roadmap", yieldsOnMobile: true },
];

// Signed out it is the opposite: About is the point of the site rather than a
// footnote, since someone arriving without an account is far more likely to be
// evaluating the work than looking for a watchlist. The bar is short enough
// here to keep it at every width.
const SIGNED_OUT: NavLink[] = [
  { href: "/about", label: "About" },
  { href: "/roadmap", label: "Roadmap", yieldsOnMobile: true },
];

function NavItem({
  link,
  current,
  className = "",
}: {
  link: NavLink;
  current: boolean;
  className?: string;
}) {
  return (
    <Link
      href={link.href}
      // aria-current is the part most navs skip. Without it the active state is
      // colour-only, which is exactly the information a screen reader loses.
      aria-current={current ? "page" : undefined}
      className={`relative py-[15px] text-sm transition-colors ${className} ${
        current
          ? "text-[var(--fg)]"
          : "text-[var(--dim)] hover:text-[var(--fg)]"
      }`}
    >
      {link.label}
      {/* The active marker is a rule flush with the bar's own hairline, so the
          nav reads as one continuous edge with a segment lit — the way a
          terminal marks a selected column, not the way a website underlines. */}
      {current && (
        <span
          aria-hidden
          className="absolute inset-x-0 -bottom-px h-px bg-[var(--gold)]"
        />
      )}
    </Link>
  );
}

export async function Nav() {
  const pathname = (await headers()).get("x-pathname") ?? "";
  // Identity comes from the header middleware already validated — no
  // round-trip, so putting the nav on every page costs nothing.
  const user = await getSessionUser();
  const links = user ? SIGNED_IN : SIGNED_OUT;

  // A company page belongs to the watchlist section — it is reached from
  // there and returns there — so the nav keeps that context lit.
  const isCurrent = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard" || pathname.startsWith("/company")
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="border-b border-[var(--rule)]">
      <Container className="flex items-center gap-3 sm:gap-6">
        <nav aria-label="Primary" className="contents">
        <Link
          href={user ? "/dashboard" : "/"}
          className="py-[15px] font-mono text-xs tracking-[0.18em] whitespace-nowrap text-[var(--fg)] uppercase transition-colors hover:text-[var(--gold)]"
        >
          <span className="hidden sm:inline">
            Financial<span className="text-[var(--gold)]">·</span>Watchlist
          </span>
          <span className="sm:hidden">
            F<span className="text-[var(--gold)]">·</span>W
          </span>
        </Link>

        {/* No hamburger. Two links do not earn a disclosure control, and
            hiding two words behind a tap is ceremony rather than design. */}
        <div className="flex items-center gap-4 sm:gap-5">
          {links.map((l) => (
            <NavItem
              key={l.href}
              link={l}
              current={isCurrent(l.href)}
              // Both reference destinations sit in the footer too, so yielding
              // one on a narrow screen costs a shortcut rather than the route.
              className={l.yieldsOnMobile ? "hidden sm:inline-flex" : ""}
            />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <ThemeToggle />
          {user ? (
            <>
              {/* An account mark rather than the address. A truncated
                  "e2e-6988c9df-e…" identified nothing and read as a rendering
                  fault; the initial plus a title carries the same confirmation
                  without the noise, and screen readers get the full address. */}
              <span
                title={user.email}
                aria-label={`Signed in as ${user.email}`}
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--rule-strong)] font-mono text-[11px] text-[var(--dim)] uppercase"
              >
                {user.email?.[0] ?? "?"}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  className="flex items-center py-[15px] text-sm whitespace-nowrap text-[var(--dim)] transition-colors hover:text-[var(--gold)]"
                >
                  <span className="hidden sm:inline">Sign out</span>
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className="size-[18px] sm:hidden"
                  >
                    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
                    <path d="M10 17l-5-5 5-5" />
                    <path d="M5 12h11" />
                  </svg>
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="py-[15px] text-sm whitespace-nowrap text-[var(--dim)] transition-colors hover:text-[var(--fg)]"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="my-[9px] flex h-9 items-center bg-[var(--gold)] px-4 text-sm font-medium whitespace-nowrap text-[var(--ground)] transition-opacity hover:opacity-90"
              >
                Start tracking
              </Link>
            </>
          )}
        </div>
        </nav>
      </Container>
    </header>
  );
}
