/**
 * Which routes require a session.
 *
 * Deliberately free of Next imports. The policy is the security-critical part
 * and must be testable on its own — when this lived inside middleware.ts it
 * dragged in `next/server` and could only be exercised by booting the whole
 * framework, which in practice means it would not have been tested at all.
 */

/** Requires a session. Matched as a path segment prefix. */
export const PROTECTED = ["/dashboard", "/company", "/alerts", "/settings"];

/** Pointless for a signed-in user; they get bounced to the dashboard. */
export const AUTH_ROUTES = ["/login", "/signup"];

/**
 * Segment-aware prefix match. A bare `startsWith` would gate `/settingsomething`
 * as though it were under `/settings`, so the boundary has to be a `/` or the
 * end of the path.
 */
export function isProtected(pathname: string): boolean {
  return PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.includes(pathname);
}
