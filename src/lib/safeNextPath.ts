// Validates a user-supplied post-login redirect target ("next" param).
// Shared by the login server action and /auth/callback so the two call sites
// cannot drift apart (threat-model K5) — the callback used to carry an older,
// weaker copy of this check.

const INTERNAL_ORIGIN = "http://internal.invalid";

/**
 * Returns `next` if it is an internal, non-auth path; otherwise `fallback`.
 *
 * A plain `startsWith("//")` check is NOT enough: "/\evil.com" starts with a
 * single slash but browsers resolve it as protocol-relative. Resolving against
 * a dummy origin catches that class (any origin escape changes u.origin). But
 * WHATWG normalisation can ALSO turn an in-origin input into a protocol-relative
 * PATH: "/.//evil.com" and "/a/..//evil.com" both normalise to "//evil.com",
 * and "/\t/evil.com" loses the tab. So the normalised result is checked again:
 * it must start with exactly one "/" and re-resolve to the dummy origin.
 */
export type SafeNextPathOptions = {
  /** Path returned when `next` is missing or unsafe. Default "/catalog". */
  fallback?: string;
  /**
   * Allow /login and /reset-password targets. Default false (the login form
   * must never bounce back onto an auth page). /auth/callback sets this: the
   * password-reset e-mail deliberately lands on
   * /auth/callback?next=/reset-password/confirm.
   */
  allowAuthPages?: boolean;
};

export function safeNextPath(next: string | null | undefined, options: SafeNextPathOptions = {}): string {
  const fallback = options.fallback ?? "/catalog";
  if (!next) return fallback;
  let path: string;
  try {
    const u = new URL(next, INTERNAL_ORIGIN);
    if (u.origin !== INTERNAL_ORIGIN) return fallback;
    path = u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  try {
    if (new URL(path, INTERNAL_ORIGIN).origin !== INTERNAL_ORIGIN) return fallback;
  } catch {
    return fallback;
  }
  // Never bounce back onto auth pages (redirect loops) unless the caller is
  // the auth callback itself.
  if (!options.allowAuthPages) {
    // Compare a decoded copy too, so "/%6Cogin" cannot slip past the prefix check.
    let decoded = path;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      /* keep raw */
    }
    for (const candidate of [path, decoded]) {
      if (candidate.startsWith("/login") || candidate.startsWith("/reset-password")) return fallback;
    }
  }
  return path;
}
