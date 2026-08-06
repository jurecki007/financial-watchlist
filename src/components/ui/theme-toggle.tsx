"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

/**
 * Dark is the lead theme; light is the alternative. The choice persists in
 * localStorage and is applied by a blocking script in <head> — doing it in an
 * effect would flash one frame of the wrong theme on every load.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  // Read what the head script already decided, rather than deciding again.
  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  const flip = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private browsing can refuse storage. The theme still applies for this
      // page; it just will not be remembered, which is a reasonable degradation.
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="flex size-7 shrink-0 items-center justify-center text-[var(--dim)] transition-colors hover:text-[var(--gold)]"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="size-[17px]"
      >
        {theme === "dark" ? (
          // The icon shows the destination, not the current state.
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        )}
      </svg>
    </button>
  );
}
