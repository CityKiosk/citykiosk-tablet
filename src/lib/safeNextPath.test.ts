// @vitest-environment node
import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safeNextPath";

describe("safeNextPath", () => {
  it("keeps ordinary internal paths, with query and hash", () => {
    expect(safeNextPath("/catalog")).toBe("/catalog");
    expect(safeNextPath("/orders/abc?x=1#h")).toBe("/orders/abc?x=1#h");
    expect(safeNextPath("/settings")).toBe("/settings");
  });

  it("falls back for empty input", () => {
    expect(safeNextPath(undefined)).toBe("/catalog");
    expect(safeNextPath(null)).toBe("/catalog");
    expect(safeNextPath("")).toBe("/catalog");
    expect(safeNextPath("", { fallback: "/stock" })).toBe("/stock");
  });

  it("rejects absolute URLs and classic protocol-relative forms", () => {
    for (const v of ["https://evil.com", "http://evil.com/x", "//evil.com", "/\\evil.com", "\\\\evil.com", "javascript:alert(1)"]) {
      expect(safeNextPath(v), v).toBe("/catalog");
    }
  });

  it("rejects inputs that only become protocol-relative after normalisation", () => {
    // These pass a naive origin check on the INPUT but normalise to "//host".
    for (const v of ["/.//evil.com", "/a/..//evil.com", "/./\\evil.com", "/\t/evil.com", "/\n/evil.com", "/..//evil.com"]) {
      expect(safeNextPath(v), JSON.stringify(v)).toBe("/catalog");
    }
  });

  it("keeps percent-encoded slashes (browsers do not decode them into an authority)", () => {
    expect(safeNextPath("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
  });

  it("never returns an auth page by default (login form must not loop)", () => {
    expect(safeNextPath("/login?next=/settings")).toBe("/catalog");
    expect(safeNextPath("/reset-password/confirm")).toBe("/catalog");
    expect(safeNextPath("/%6Cogin")).toBe("/catalog");
    expect(safeNextPath("/%72eset-password/confirm")).toBe("/catalog");
  });

  it("lets /auth/callback forward to the password-reset confirm page", () => {
    // The reset e-mail's redirectTo is /auth/callback?next=/reset-password/confirm.
    expect(safeNextPath("/reset-password/confirm", { allowAuthPages: true })).toBe("/reset-password/confirm");
    // ...but the origin checks still apply with the option on.
    expect(safeNextPath("/.//evil.com", { allowAuthPages: true })).toBe("/catalog");
    expect(safeNextPath("//evil.com", { allowAuthPages: true })).toBe("/catalog");
  });

  it("result always starts with exactly one slash", () => {
    const vectors = ["/.//x", "/x", "//x", "/\\x", "x", "/a/../b", "/%2F%2Fx", "/\t/x"];
    for (const v of vectors) {
      const out = safeNextPath(v);
      expect(out.startsWith("/"), v).toBe(true);
      expect(out.startsWith("//"), v).toBe(false);
      expect(out.startsWith("/\\"), v).toBe(false);
    }
  });
});
