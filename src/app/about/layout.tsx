import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/ui/footer";
import { Container } from "@/components/ui/shell";
import { AboutTabs } from "@/components/about/about-tabs";

/**
 * The About section and its own two-tab bar.
 *
 * A second bar rather than two more entries in the primary nav. The primary
 * nav already carries four destinations plus a wordmark, theme toggle, account
 * mark and sign-out, and it already drops Roadmap below `sm` to fit; six would
 * have meant hiding half of them on a phone. These two pages are also a pair —
 * a recruiter reading one wants the other — and pairs belong next to each other
 * rather than scattered across the top level.
 *
 * The tabs are a client component, and that is not an oversight. A layout does
 * not re-render when navigating between the routes that share it, so anything
 * here that derives from the current path is frozen at whatever it was when the
 * section mounted. `Nav` gets away with reading the path from headers because
 * every route under /about lights the same "About" entry; the tab bar does not,
 * so it reads the path reactively instead. See components/about/about-tabs.
 */
export default function AboutLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      <div className="border-b border-[var(--rule)]">
        <Container>
          <AboutTabs />
        </Container>
      </div>

      <main className="min-h-screen py-12">{children}</main>
      <Footer />
    </>
  );
}
