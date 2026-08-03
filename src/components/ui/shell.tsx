import type { ReactNode } from "react";

/**
 * The one container every page and the nav share.
 *
 * It exists because they had drifted: the nav applied its padding INSIDE the
 * max-width box while pages applied it outside, so every heading sat 40px out
 * of register with the bar above it. That is invisible in source and obvious
 * in a screenshot, and it is exactly the class of bug a shared primitive
 * prevents rather than fixes repeatedly.
 */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[62rem] px-6 sm:px-10 ${className}`}>
      {children}
    </div>
  );
}
