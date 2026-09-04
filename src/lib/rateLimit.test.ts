// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getClientIp, healthDbRateLimit } from "./rateLimit";

function headersOf(map: Record<string, string>) {
  return { get: (name: string) => map[name.toLowerCase()] ?? null };
}

describe("getClientIp", () => {
  it("uses the FIRST X-Forwarded-For element (Render writes the client there)", () => {
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
