import { describe, expect, it } from "vitest";
import { MAX_MONEY, MoneyError, parsePositiveMoney, percentOf, toMajor, toMinor } from "@/lib/money";

describe("toMinor", () => {
  it("converts numbers, strings and Decimal-like objects alike", () => {
    expect(toMinor(12.34)).toBe(1234);
    expect(toMinor("12.34")).toBe(1234);
    expect(toMinor({ toString: () => "12.34" })).toBe(1234);
  });

  it("rounds to the nearest paisa", () => {
    expect(toMinor(0.005)).toBe(1);
    expect(toMinor(0.004)).toBe(0);
    expect(toMinor(1.555)).toBe(156);
  });

  it("rounds half away from zero, the convention a cash drawer uses", () => {
    expect(toMinor(2.345)).toBe(235);
    expect(toMinor(-2.345)).toBe(-235);
  });

  it("rejects values that are not numbers", () => {
    expect(() => toMinor("abc")).toThrow(RangeError);
    expect(() => toMinor(Number.NaN)).toThrow(RangeError);
    expect(() => toMinor(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("rejects values a Decimal(10,2) column could not hold", () => {
    expect(() => toMinor(MAX_MONEY + 1)).toThrow(RangeError);
  });
});

describe("toMajor", () => {
  it("round-trips through minor units without drift", () => {
    for (const value of [0, 0.01, 1, 19.99, 1234.56, 99999.99]) {
      expect(toMajor(toMinor(value))).toBe(value);
    }
  });

  it("does not accumulate floating-point error across many additions", () => {
    // 0.1 + 0.2 + 0.3 ... in floats drifts; in minor units it cannot.
    let minor = 0;
    for (let i = 0; i < 1000; i += 1) {
      minor += toMinor(0.1);
    }
    expect(toMajor(minor)).toBe(100);
  });
});

describe("parsePositiveMoney", () => {
  it("accepts zero and positive amounts", () => {
    expect(parsePositiveMoney(0, "Discount")).toBe(0);
    expect(parsePositiveMoney("250", "Discount")).toBe(25000);
  });

  it("rejects negative amounts", () => {
    expect(() => parsePositiveMoney(-1, "Discount")).toThrow(MoneyError);
  });

  it("reports the offending field so the cashier sees a useful message", () => {
    expect(() => parsePositiveMoney("nonsense", "Delivery charge")).toThrow(
      /Delivery charge is not a valid amount/
    );
  });
});

describe("percentOf", () => {
  it("computes tax to the nearest paisa", () => {
    expect(percentOf(10000, 5)).toBe(500); // 5% of Rs. 100.00
    expect(percentOf(3333, 5)).toBe(167); // rounds 166.65 up
  });

  it("treats a zero or negative rate as no tax", () => {
    expect(percentOf(10000, 0)).toBe(0);
    expect(percentOf(10000, -5)).toBe(0);
  });
});
