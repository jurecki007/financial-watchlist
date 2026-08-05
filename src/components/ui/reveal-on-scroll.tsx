"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * A header that is out of the way until you go looking for it.
 *
 * On the auth pages the form is the whole task, and a full nav above it offers
 * four ways to leave at the moment we are asking someone to stay. So it starts
 * translated out of view and comes down once the page has moved.
 *
 * Two things this has to get right, both of which a plain scroll listener
 * misses:
 *
 * 1. **Keyboard.** A translated element is still in the document and still
 *    focusable, so tabbing lands on links nobody can see. `focus-within`
 *    brings the bar down the moment anything inside it takes focus, so the
 *    keyboard path reveals it rather than falling into it.
 * 2. **Pages that cannot scroll.** If the content is shorter than the viewport
 *    the scroll event never fires and a pointer user can never reach the nav.
 *    Measured at a 2400px-tall viewport, this branch does not currently fire —
 *    the shell is `min-h-screen` and the footer sits below it, so the page
 *    always exceeds the viewport by roughly the footer's height. It is kept
 *    because it guards a specific regression rather than a hypothetical one:
 *    shortening this page is a one-line change, and it would make the nav
 *    unreachable by pointer with nothing on screen to indicate it.
 *
 * Children are server-rendered and passed through, so the actual nav stays a
 * server component and no session logic crosses into the client.
 */
export function RevealOnScroll({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const evaluate = () => {
      const scrollable =
        document.documentElement.scrollHeight >
        document.documentElement.clientHeight + 8;
      setShown(!scrollable || window.scrollY > 24);
    };

    evaluate();
    window.addEventListener("scroll", evaluate, { passive: true });
    // Content can grow after first paint — a validation error appearing under
    // a field is enough to turn an unscrollable page into a scrollable one.
    const ro = new ResizeObserver(evaluate);
    ro.observe(document.documentElement);
    return () => {
      window.removeEventListener("scroll", evaluate);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      // `focus-within:` is the keyboard escape hatch described above; it wins
      // over the translate because it comes later in the class list and both
      // are the same specificity.
      className={`fixed inset-x-0 top-0 z-40 bg-[var(--ground)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-within:translate-y-0 motion-reduce:transition-none ${
        shown ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      {children}
    </div>
  );
}
