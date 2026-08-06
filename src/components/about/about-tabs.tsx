"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The About section's tab bar. A client component because a layout does not
 * re-render when navigating between the routes that share it, so a path read
 * from headers would freeze at whatever it was when the section mounted.
 *
 * One marker for the whole bar rather than one per tab, which is what lets it
 * travel — two cross-fading markers say something turned off and another on.
 */

const TABS = [
  { href: "/about/project", label: "The project" },
  { href: "/about/author", label: "The author" },
];

type Marker = { x: number; w: number };

export function AboutTabs() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const items = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [marker, setMarker] = useState<Marker | null>(null);
  // False for the first paint so the marker appears already in place instead of
  // flying in from the left edge on load — an entrance nobody asked for.
  const [travels, setTravels] = useState(false);

  const measure = useCallback(() => {
    const el = items.current[pathname];
    const nav = navRef.current;
    if (!el || !nav) {
      setMarker(null);
      return;
    }
    const a = el.getBoundingClientRect();
    const b = nav.getBoundingClientRect();
    setMarker({ x: a.left - b.left, w: a.width });
  }, [pathname]);

  useEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setTravels(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    // Sized from rendered text, so a font swapping in after first paint has to
    // trigger a re-measure.
    const ro = new ResizeObserver(measure);
    if (navRef.current) ro.observe(navRef.current);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <nav aria-label="About" ref={navRef} className="relative flex gap-6">
      {TABS.map((t) => {
        const current = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            ref={(el) => {
              items.current[t.href] = el;
            }}
            // Without it the active tab is signalled by colour alone, which a
            // screen reader cannot see.
            aria-current={current ? "page" : undefined}
            className={`relative py-3.5 text-sm transition-colors ${
              current
                ? "text-[var(--fg)]"
                : "text-[var(--dim)] hover:text-[var(--fg)]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}

      {/* Transform only — a 1px bar scaled and translated, never re-laid out.
          Animating left/width would work at this size but puts layout on the
          main thread for every frame of every tab change, which is a habit that
          stops being free the moment this pattern is reused somewhere denser.

          Sits on the container's own hairline rather than under the label, so
          the bar reads as one continuous edge with a segment lit — the same
          idiom as the primary nav, which is why they look related. */}
      {marker && (
        <span
          aria-hidden
          style={{ transform: `translateX(${marker.x}px) scaleX(${marker.w})` }}
          className={`absolute -bottom-px left-0 h-px w-px origin-left bg-[var(--gold)] ${
            travels
              ? // Strong ease-out: quick to commit, settling rather than
                // gliding to a stop. Reduced motion gets the same final
                // position with no travel at all.
                "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              : ""
          }`}
        />
      )}
    </nav>
  );
}
