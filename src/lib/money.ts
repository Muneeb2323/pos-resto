/**
 * Money arithmetic for the POS.
 *
 * All monetary values are held as integer minor units (paisa) internally so that
 * summing an order never accumulates binary floating-point drift. Values cross the
 * API and Prisma boundaries as ordinary 2-decimal numbers, which `Decimal(10,2)`
 * columns store exactly.
 */

/** Largest value we accept from a client, guarding against overflow of Decimal(10,2). */
export const MAX_MONEY = 99_999_999.99;

/** Convert a value of unknown provenance to integer paisa. Throws on anything non-finite. */
export function toMinor(value: unknown): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : typeof value === "object" && value !== null && "toString" in value
          ? Number((value as { toString(): string }).toString())
          : NaN;

  if (!Number.isFinite(numeric)) {
    throw new RangeError(`Not a valid monetary amount: ${String(value)}`);
  }
  if (Math.abs(numeric) > MAX_MONEY) {
    throw new RangeError(`Monetary amount out of range: ${numeric}`);
  }
  // Round half away from zero, the convention cash drawers use.
  return Math.round(Math.abs(numeric) * 100) * Math.sign(numeric || 1);
}

/** Convert integer paisa back to a 2-decimal number safe for Decimal(10,2). */
export function toMajor(minor: number): number {
  return Math.round(minor) / 100;
}

/** Parse a client-supplied amount, rejecting negatives. Returns integer paisa. */
export function parsePositiveMoney(value: unknown, fieldName: string): number {
  let minor: number;
  try {
    minor = toMinor(value ?? 0);
  } catch {
    throw new MoneyError(`${fieldName} is not a valid amount`);
  }
  if (minor < 0) {
    throw new MoneyError(`${fieldName} cannot be negative`);
  }
  return minor;
}

/** Percentage of an amount, rounded to the nearest paisa. */
export function percentOf(minor: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round((minor * rate) / 100);
}

/** A rejected amount — surfaced to the caller as a 400, never a 500. */
export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}
