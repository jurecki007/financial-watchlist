"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * A header kept out of the way until you go looking for it: on the auth pages
 * the form is the task, and a full nav offers four ways to leave.
 *
 * Two cases a plain scroll listener misses. A translated element is still
 * focusable, so `focus-within` reveals the bar rather than letting tab order
 * fall into it. And a page shorter than the viewport never fires scroll at all,
 * which would leave the nav unreachable by pointer.
 *
 * Children are server-rendered and passed through, so the nav stays a server
 * component.
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
      // `focus-within:` wins over the translate: same specificity, later in
      // the class list.
      className={`fixed inset-x-0 top-0 z-40 bg-[var(--ground)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-within:translate-y-0 motion-reduce:transition-none ${
        shown ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      {children}
    </div>
  );
}
