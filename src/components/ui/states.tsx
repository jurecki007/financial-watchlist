import type { ReactNode } from "react";

/**
 * The three async states, as shared primitives.
 *
 * They live together because every async surface owes all three, and keeping
 * them in one file makes a missing one obvious. CLAUDE.md rule 6.
 */

/**
 * Skeleton block.
 *
 * Opacity pulse, never a shimmer sweep — shimmer is a consumer-app tic that
 * fights the market-native register. Under prefers-reduced-motion the pulse
 * stops, which is correct rather than degraded.
 *
 * The `skeleton` class holds it invisible for 200ms first. Content that
 * streams in faster than that replaces the placeholder before it was ever
 * seen, so a fast load shows no skeleton at all rather than a flash.
 */
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={`skeleton animate-pulse rounded-[2px] bg-[var(--rule)] motion-reduce:animate-none ${className}`}
    />
  );
}

/**
 * A number-shaped placeholder.
 *
 * Width is set in `ch` of the mono face, which is the real digit advance, so
 * the block occupies roughly the space the figure will. It reads as "a number
 * is arriving here" rather than as a generic bar, and the row does not resize
 * when the value lands.
 */
export function NumberSkeleton({
  digits = 6,
  className = "",
}: {
  digits?: number;
  className?: string;
}) {
  return (
    <Skeleton
      className={`h-[0.85em] font-mono ${className}`}
      style={{ width: `${digits}ch` }}
    />
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-[var(--rule-strong)] px-6 py-14 text-center">
      <p className="text-[0.95rem] font-medium">{title}</p>
      <p className="mx-auto mt-2 max-w-[38ch] text-sm leading-relaxed text-[var(--dim)]">
        {body}
      </p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Error state with an optional retry.
 *
 * Takes already-mapped copy — a raw provider message must never reach here.
 * `retry` is omitted for failures that cannot succeed on a second attempt (a
 * paywalled endpoint, an unknown symbol): offering a button that cannot work
 * is worse than offering none.
 */
export function ErrorState({
  title,
  body,
  retry,
}: {
  title: string;
  body: string;
  retry?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="border-l-2 border-[var(--down)] bg-[var(--raised)] px-4 py-3.5"
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">{body}</p>
      {retry && <div className="mt-3">{retry}</div>}
    </div>
  );
}

/**
 * "as of 14:32" badge.
 *
 * Shown whenever data came from cache. Being explicit about age is precisely
 * what licenses serving a stale price instead of an error — the number is only
 * misleading if we imply it is live.
 */
export function AsOf({ time, stale }: { time?: string; stale?: boolean }) {
  if (!time) return null;
  const hhmm = new Date(time).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <span
      className={`font-mono text-[11px] ${
        stale ? "text-[var(--gold)]" : "text-[var(--faint)]"
      }`}
      title={
        stale ? "Showing the last known price; a refresh failed." : undefined
      }
    >
      as of {hhmm}
    </span>
  );
}
