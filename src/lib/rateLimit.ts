// In-memory sliding window rate limiter.
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

  /** Returns true if the request is allowed, false if rate-limited. */
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
