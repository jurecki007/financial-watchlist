import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/ui/footer";
import { Container } from "@/components/ui/shell";
import { AboutTabs } from "@/components/about/about-tabs";

/**
 * The About section and its own tab bar — a second bar rather than two more
 * primary-nav entries, which would have meant hiding half of them on a phone.
 *
 * The tabs are a client component deliberately: a layout does not re-render
 * between the routes that share it, so a path read here would freeze. `Nav`
 * gets away with it because every /about route lights the same entry.
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
