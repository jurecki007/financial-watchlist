import type { ReactNode } from "react";

/**
 * The three async states, together in one file so a missing one is obvious.
 */

/**
 * Opacity pulse, never a shimmer sweep. Held invisible for 200ms first, so
 * content that streams in faster replaces it before it was ever seen.
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
 * A number-shaped placeholder. Width in `ch` of the mono face, so it occupies
 * the space the figure will and the row does not resize when it lands.
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
 * Takes already-mapped copy; a raw provider message must never reach here.
 * `retry` is omitted where a second attempt cannot succeed.
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
 * Shown whenever data came from cache. Being explicit about age is what
 * licenses serving a stale price instead of an error.
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
