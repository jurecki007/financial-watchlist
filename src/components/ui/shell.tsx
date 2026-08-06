import type { ReactNode } from "react";

/**
 * The one container every page and the nav share, so their padding cannot
 * drift out of register — a misalignment invisible in source and obvious in a
 * screenshot.
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
