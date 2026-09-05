import { describe, expect, it } from "vitest";
import { computeEarningsCents } from "@/server/domain/payout";

describe("computeEarningsCents", () => {
  it("returns 0 for 0 views", () => {
    expect(computeEarningsCents(0, 100)).toBe(0);
  });

  it("returns 0 for views below the 1k threshold", () => {
    expect(computeEarningsCents(999, 100)).toBe(0);
  });

  it("pays exactly one unit at exactly 1000 views", () => {
    expect(computeEarningsCents(1000, 100)).toBe(100);
  });

  it("floors partial thousands rather than rounding", () => {
    expect(computeEarningsCents(1999, 100)).toBe(100);
    expect(computeEarningsCents(2000, 100)).toBe(200);
  });

  it("scales correctly for large view counts", () => {
    // floor(1234567 / 1000) = 1234, * 50 cents = 61700 cents
    expect(computeEarningsCents(1_234_567, 50)).toBe(61_700);
  });

  it("handles a payout rate of 0", () => {
    expect(computeEarningsCents(5000, 0)).toBe(0);
  });
});
