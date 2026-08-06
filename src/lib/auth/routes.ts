/**
 * Which routes require a session.
 *
 * Free of Next imports on purpose: the policy is the security-critical part,
 * and keeping it framework-free is what makes it unit-testable.
 */

/** Requires a session. Matched as a path segment prefix. */
export const PROTECTED = [
  "/dashboard",
  "/company",
  "/news",
  "/alerts",
  "/settings",
];

/** Pointless for a signed-in user; they get bounced to the dashboard. */
export const AUTH_ROUTES = ["/login", "/signup"];

/**
 * Segment-aware: a bare `startsWith` would gate `/settingsomething` as though
 * it sat under `/settings`.
 */
export function isProtected(pathname: string): boolean {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.includes(pathname);
}

/**
 * Sanitises a post-authentication destination. An open redirect here is a
 * phishing primitive — it bounces the user off-site moments after they typed a
 * password.
 *
 * `//evil.com` is the case that catches people: protocol-relative, so a bare
 * `startsWith("/")` treats it as local.
 */
export function safeRedirectPath(
  value: unknown,
  fallback = "/dashboard",
): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  // Some browsers normalise backslashes, so `/\evil.com` escapes the origin too.
  if (value.startsWith("/\\")) return fallback;
  return value;
}
