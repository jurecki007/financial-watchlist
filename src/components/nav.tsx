import Link from "next/link";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { Container } from "@/components/ui/shell";

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

type NavLink = { href: string; label: string };

const SIGNED_IN: NavLink[] = [
  { href: "/dashboard", label: "Watchlist" },
  { href: "/roadmap", label: "Roadmap" },
];

const SIGNED_OUT: NavLink[] = [{ href: "/roadmap", label: "Roadmap" }];

function NavItem({
  link,
  current,
}: {
  link: NavLink;
  current: boolean;
}) {
  return (
    <Link
      href={link.href}
      // aria-current is the part most navs skip. Without it the active state is
      // colour-only, which is exactly the information a screen reader loses.
      aria-current={current ? "page" : undefined}
      className={`relative py-[15px] text-sm transition-colors ${
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

  const isCurrent = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard" || pathname.startsWith("/company")
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="border-b border-[var(--rule)]">
      <Container className="flex items-center gap-6">
        <nav aria-label="Primary" className="contents">
        <Link
          href={user ? "/dashboard" : "/"}
          className="py-[15px] font-mono text-xs tracking-[0.18em] whitespace-nowrap text-[var(--fg)] uppercase transition-colors hover:text-[var(--gold)]"
        >
          Financial<span className="text-[var(--gold)]">·</span>Watchlist
        </Link>

        {/* No hamburger. Two links do not earn a disclosure control, and
            hiding two words behind a tap is ceremony rather than design. */}
        <div className="flex items-center gap-5">
          {links.map((l) => (
            <NavItem key={l.href} link={l} current={isCurrent(l.href)} />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-5">
          {user ? (
            <>
              {/* The address is confirmation of which account you are in —
                  useful, but never the loudest thing in the bar. Hidden on the
                  narrowest screens where the links matter more. */}
              <span className="hidden max-w-[16ch] truncate font-mono text-[11px] text-[var(--faint)] sm:inline">
                {user.email}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="py-[15px] text-sm whitespace-nowrap text-[var(--dim)] transition-colors hover:text-[var(--gold)]"
                >
                  Sign out
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
