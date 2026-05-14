import { describe, expect, it } from "vitest";
import { applyDiscount, calculateTax, DEFAULT_TAX_RATE, MAX_DISCOUNT_PCT } from "./tax";

describe("calculateTax", () => {
  it("rounds VAT and gross to 2 decimals", () => {
    const { tax, gross } = calculateTax(100, 19);
    expect(tax).toBe(19);
    expect(gross).toBe(119);
  });

  it("handles a fractional net without floating-point drift (the 0.1+0.2 trap)", () => {
    // 582.08 × 19% = 110.5952 → 110.60 (banker's: half-up via Math.round)
    const { tax, gross } = calculateTax(582.08, 19);
    expect(tax).toBe(110.6);
    expect(gross).toBe(692.68);
  });

  it("zero net yields zero tax and zero gross", () => {
    expect(calculateTax(0, 19)).toEqual({ tax: 0, gross: 0 });
  });

  it("defaults to DEFAULT_TAX_RATE when no rate is passed", () => {
    expect(calculateTax(100)).toEqual(calculateTax(100, DEFAULT_TAX_RATE));
  });
});

describe("applyDiscount", () => {
  it("returns the original net when discountPct is 0", () => {
    const r = applyDiscount(582.08, 0);
    expect(r.discountAmount).toBe(0);
    expect(r.net).toBe(582.08);
    expect(r.tax).toBe(110.6);
    expect(r.gross).toBe(692.68);
  });

  it("computes a 10% discount and recomputes VAT on the discounted net", () => {
    const r = applyDiscount(582.08, 10);
    // 582.08 × 10 / 100 = 58.208 → 58.21 (Math.round)
    expect(r.discountAmount).toBe(58.21);
    // 582.08 - 58.21 = 523.87
    expect(r.net).toBe(523.87);
    // 523.87 × 19% = 99.5353 → 99.54
    expect(r.tax).toBe(99.54);
    // 523.87 + 99.54 = 623.41
    expect(r.gross).toBe(623.41);
  });

  it("clamps negative percentages to 0", () => {
    const r = applyDiscount(100, -5);
    expect(r.discountAmount).toBe(0);
    expect(r.net).toBe(100);
  });

  it("clamps percentages above MAX_DISCOUNT_PCT", () => {
    const r = applyDiscount(100, 999);
    // 100 × 20 / 100 = 20
    expect(r.discountAmount).toBe(20);
    expect(r.net).toBe(80);
  });

  it("truncates fractional percentages — 9.9 behaves as 9", () => {
    const r = applyDiscount(100, 9.9);
    expect(r.discountAmount).toBe(9);
    expect(r.net).toBe(91);
  });

  it("MAX_DISCOUNT_PCT matches the DB CHECK constraint upper bound (20)", () => {
    // Defensive sentinel — if someone bumps this on either side without
    // updating the migration, the discount column constraint will reject
    // inserts at the DB layer. Keep the two in lockstep.
    expect(MAX_DISCOUNT_PCT).toBe(20);
  });
});
