// In-memory FIXED-window rate limiter (window starts at the first hit and
// resets when it expires; a burst of 2× the limit is possible across a boundary).
// Works on Render (persistent Node.js process). NOT suitable for serverless (Vercel/Lambda).

type Entry = { count: number; resetAt: number };

class RateLimit {
  store = new Map<string, Entry>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /** Consume one slot. Returns true if the request is allowed, false if rate-limited. */
  check(key: string): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count < this.maxRequests) {
      entry.count++;
      return true;
    }

    return false;
  }

  /** Peek without consuming: is this key currently over its limit? */
  isLimited(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry || Date.now() >= entry.resetAt) return false;
    return entry.count >= this.maxRequests;
  }

  /** Record one failure for keys that count failures only (see loginEmailRateLimit). */
  hit(key: string): void {
    this.check(key);
  }

  /** Clear a key, e.g. after a successful login. */
  reset(key: string): void {
    this.store.delete(key);
  }
}

// Cleanup stale entries every 5 minutes to prevent memory leak
function createLimiter(maxRequests: number, windowMs: number): RateLimit {
  const rl = new RateLimit(maxRequests, windowMs);
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rl.store) {
      if (now >= entry.resetAt) rl.store.delete(key);
    }
  }, 5 * 60 * 1000).unref();
  return rl;
}

/** Login: 5 attempts per minute per IP */
export const loginRateLimit = createLimiter(5, 60_000);

/** Admin PIN verify: 5 attempts per minute per user.
 * Keyed on user.id, not IP — the threat model is a local attacker sharing
 * the owner's authenticated session, so IP-based keys are meaningless
 * (and trusting X-Forwarded-For is unsafe). */
export const pinVerifyRateLimit = createLimiter(5, 60_000);

/** Admin PIN set/rotate: 3 attempts per 5 minutes per user.
 * Separate bucket so an unlock lockout doesn't block the owner from
 * changing the PIN (and vice versa). Rotation path is rarer, so tighter. */
export const pinSetRateLimit = createLimiter(3, 5 * 60_000);

/** Order creation: 60 per minute per user. Prevents queue replay / fuzzing
 * abuse. Idempotency key handles same-key duplicates; this caps fresh-key
 * spam where an attacker generates new keys to bypass dedup. */
export const createOrderRateLimit = createLimiter(60, 60_000);

/** Password reset confirm: 5 attempts per minute per user.
 * Keyed on user.id — same reasoning as pinVerifyRateLimit: the threat model
 * is a local attacker on the shared tablet, so IP is meaningless. */
export const passwordResetRateLimit = createLimiter(5, 60_000);

/** Client IP for IP-keyed limiters, behind Render + Cloudflare.
 *
 * Trust order:
 *  1. `cf-connecting-ip` — written by Cloudflare (which fronts every Render
 *     service) from the TCP peer; a client-supplied value is overwritten at the
 *     edge, so it cannot be spoofed there. (`true-client-ip` is the same value
 *     under another name and is deliberately NOT read: off-Cloudflare it would
 *     be one more spoofable header.)
 *  2. First `x-forwarded-for` element — verified live on 2026-09-04 against the
 *     XFF-only code: Render does NOT reset this header, it APPENDS its hops
 *     ("client, cf-edge, render-lb"), so a client can prepend anything. 7
 *     requests with 7 different fake values each got their own bucket, the
 *     same fake value ×7 hit 429. Kept only as a fallback for environments
 *     without Cloudflare (local dev).
 *  3. `x-real-ip`, then "unknown".
 * Post-deploy check for (1): 7 requests with DIFFERENT fake cf-connecting-ip
 * and x-forwarded-for values must still hit 429 on the 7th.
 * Any IP-keyed limit is best-effort; endpoints that matter also carry a key
 * the client cannot choose (target e-mail for login) or a global cap. */
export function getClientIp(h: { get(name: string): string | null }): string {
  const edge = h.get("cf-connecting-ip")?.trim();
  if (edge) return edge;
  const xff = h.get("x-forwarded-for");
  const first = xff?.split(",").map((s) => s.trim()).find(Boolean);
  return first || h.get("x-real-ip")?.trim() || "unknown";
}

/** Login, second key: FAILED attempts per TARGET e-mail (lower-cased) —
 * 10 failures per 10 minutes. Use isLimited() before signing in, hit() after a
 * failed sign-in, reset() after a successful one. Counting only failures and
 * clearing on success means a drip of bogus attempts cannot hold the owner's
 * account closed, and a successful owner login clears it.
 * Defence-in-depth only: the attacker can also call GoTrue's password grant
 * directly with the public anon key, which this limiter never sees — the
 * auth-layer protections (Supabase bot/abuse protection, a long random
 * password) are the real brute-force barrier. */
export const loginEmailRateLimit = createLimiter(10, 10 * 60_000);

/** DB keep-alive ping (/api/health/db): 6 per minute per IP.
 * The endpoint hits Supabase on every call (no cache) and is unauthenticated,
 * so without a cap it amplifies into a DB/quota DoS. The legitimate caller is a
 * cron job pinging a few times a day — 6/min is generous. */
export const healthDbRateLimit = createLimiter(6, 60_000);

/** DB keep-alive ping, global cap: 30 per minute across ALL callers. The only
 * legitimate caller is the uptime monitor (a few pings per day); the per-IP
 * limit above is spoofable via headers, this one is keyed on nothing the
 * client controls. */
export const healthDbGlobalRateLimit = createLimiter(30, 60_000);
