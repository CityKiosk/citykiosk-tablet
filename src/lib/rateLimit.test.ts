// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getClientIp, healthDbGlobalRateLimit, healthDbRateLimit, loginEmailRateLimit, publicCatalogRateLimit } from "./rateLimit";

function headersOf(map: Record<string, string>) {
  return { get: (name: string) => map[name.toLowerCase()] ?? null };
}

describe("getClientIp", () => {
  it("prefers cf-connecting-ip over a client-supplied X-Forwarded-For (spoof-proof at the edge)", () => {
    const h = headersOf({ "cf-connecting-ip": "198.51.100.9", "x-forwarded-for": "203.0.113.7, 172.71.1.1" });
    expect(getClientIp(h)).toBe("198.51.100.9");
  });

  it("ignores true-client-ip (spoofable off-Cloudflare) and falls through to X-Forwarded-For", () => {
    const h = headersOf({ "true-client-ip": "198.51.100.10", "x-forwarded-for": "203.0.113.7" });
    expect(getClientIp(h)).toBe("203.0.113.7");
  });

  it("treats a blank cf-connecting-ip as absent", () => {
    const h = headersOf({ "cf-connecting-ip": "   ", "x-forwarded-for": "203.0.113.7" });
    expect(getClientIp(h)).toBe("203.0.113.7");
  });

  it("without edge headers uses the FIRST X-Forwarded-For element (dev fallback)", () => {
    const h = headersOf({ "x-forwarded-for": "203.0.113.7, 172.71.1.1, 10.0.0.5" });
    expect(getClientIp(h)).toBe("203.0.113.7");
  });

  it("does not key on the rotating last proxy hop", () => {
    const a = headersOf({ "x-forwarded-for": "203.0.113.7, 172.71.1.1" });
    const b = headersOf({ "x-forwarded-for": "203.0.113.7, 172.71.9.9" });
    expect(getClientIp(a)).toBe(getClientIp(b));
  });

  it("trims whitespace and skips empty leading entries", () => {
    expect(getClientIp(headersOf({ "x-forwarded-for": "  , 203.0.113.7 " }))).toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP when X-Forwarded-For is missing", () => {
    expect(getClientIp(headersOf({ "x-real-ip": " 198.51.100.2 " }))).toBe("198.51.100.2");
  });

  it("falls back to 'unknown' when no header is present", () => {
    expect(getClientIp(headersOf({}))).toBe("unknown");
  });
});

describe("loginEmailRateLimit (failures only, 10 per 10 minutes per e-mail)", () => {
  it("does not limit until 10 FAILURES were recorded, and a success clears it", () => {
    vi.useFakeTimers();
    try {
      const key = "owner-" + Math.random() + "@example.com";
      // Peeking never consumes: an attacker's successful-looking probes do not count.
      for (let i = 0; i < 50; i++) expect(loginEmailRateLimit.isLimited(key)).toBe(false);
      for (let i = 0; i < 9; i++) loginEmailRateLimit.hit(key);
      expect(loginEmailRateLimit.isLimited(key)).toBe(false);
      loginEmailRateLimit.hit(key);
      expect(loginEmailRateLimit.isLimited(key)).toBe(true);
      loginEmailRateLimit.reset(key);
      expect(loginEmailRateLimit.isLimited(key)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("expires after the 10-minute window", () => {
    vi.useFakeTimers();
    try {
      const key = "owner2-" + Math.random() + "@example.com";
      for (let i = 0; i < 10; i++) loginEmailRateLimit.hit(key);
      expect(loginEmailRateLimit.isLimited(key)).toBe(true);
      vi.advanceTimersByTime(10 * 60_000 + 1);
      expect(loginEmailRateLimit.isLimited(key)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("publicCatalogRateLimit (60 per minute, global)", () => {
  it("allows 60 misses then blocks the 61st on the shared global key", () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 60; i++) expect(publicCatalogRateLimit.check("global")).toBe(true);
      expect(publicCatalogRateLimit.check("global")).toBe(false);
      vi.advanceTimersByTime(60_001);
      expect(publicCatalogRateLimit.check("global")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("healthDbGlobalRateLimit (30 per minute, single key)", () => {
  it("blocks the 31st request regardless of caller", () => {
    vi.useFakeTimers();
    try {
      const key = "global-test-" + Math.random();
      for (let i = 0; i < 30; i++) expect(healthDbGlobalRateLimit.check(key)).toBe(true);
      expect(healthDbGlobalRateLimit.check(key)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("healthDbRateLimit (6 per minute per key)", () => {
  it("allows 6 requests then blocks the 7th, and resets after the window", () => {
    vi.useFakeTimers();
    try {
      const key = "test-key-" + Math.random();
      for (let i = 0; i < 6; i++) expect(healthDbRateLimit.check(key)).toBe(true);
      expect(healthDbRateLimit.check(key)).toBe(false);
      vi.advanceTimersByTime(60_001);
      expect(healthDbRateLimit.check(key)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
