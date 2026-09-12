import { beforeEach, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { checkThrottle, recordFailure, recordSuccess, resetThrottle } from "@/lib/auth/rateLimit";
import {
  canAccessModule,
  canCancelOrder,
  canManageBackup,
  canManageMenu,
  canManageStaff,
  canRefundPayment,
} from "@/lib/auth/permissions";

describe("sign-in throttling", () => {
  beforeEach(() => resetThrottle());

  it("allows an unknown key through", () => {
    expect(checkThrottle("192.168.0.5|admin").blocked).toBe(false);
  });

  it("allows a handful of mistyped passwords", () => {
    const key = "192.168.0.5|admin";
    for (let i = 0; i < 7; i += 1) {
      recordFailure(key);
      expect(checkThrottle(key).blocked).toBe(false);
    }
  });

  it("locks the key once the attempt limit is reached", () => {
    const key = "192.168.0.5|admin";
    for (let i = 0; i < 8; i += 1) recordFailure(key);

    const state = checkThrottle(key);
    expect(state.blocked).toBe(true);
    expect(state.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps terminals independent, so one cashier cannot lock out another", () => {
    for (let i = 0; i < 8; i += 1) recordFailure("192.168.0.5|admin");

    expect(checkThrottle("192.168.0.5|admin").blocked).toBe(true);
    expect(checkThrottle("192.168.0.9|admin").blocked).toBe(false);
  });

  it("clears the history after a successful sign-in", () => {
    const key = "192.168.0.5|admin";
    for (let i = 0; i < 5; i += 1) recordFailure(key);
    recordSuccess(key);
    for (let i = 0; i < 5; i += 1) recordFailure(key);

    expect(checkThrottle(key).blocked).toBe(false);
  });
});

describe("role permissions", () => {
  it("gives an admin every module", () => {
    for (const appModule of ["dashboard", "pos", "reports", "staff", "settings", "backup"] as const) {
      expect(canAccessModule(Role.ADMIN, appModule)).toBe(true);
    }
  });

  it("keeps a cashier out of the back office", () => {
    expect(canAccessModule(Role.CASHIER, "pos")).toBe(true);
    expect(canAccessModule(Role.CASHIER, "orders")).toBe(true);
    expect(canAccessModule(Role.CASHIER, "reports")).toBe(false);
    expect(canAccessModule(Role.CASHIER, "settings")).toBe(false);
    expect(canAccessModule(Role.CASHIER, "staff")).toBe(false);
    expect(canAccessModule(Role.CASHIER, "backup")).toBe(false);
  });

  it("confines kitchen staff to the kitchen", () => {
    expect(canAccessModule(Role.KITCHEN, "kitchen")).toBe(true);
    for (const appModule of ["pos", "orders", "reports", "settings", "menu"] as const) {
      expect(canAccessModule(Role.KITCHEN, appModule)).toBe(false);
    }
  });

  it("restricts money-reversing actions to managers and admins", () => {
    expect(canCancelOrder(Role.CASHIER)).toBe(false);
    expect(canRefundPayment(Role.CASHIER)).toBe(false);
    expect(canCancelOrder(Role.MANAGER)).toBe(true);
    expect(canRefundPayment(Role.ADMIN)).toBe(true);
  });

  it("restricts staff accounts and backups to admins alone", () => {
    expect(canManageStaff(Role.MANAGER)).toBe(false);
    expect(canManageStaff(Role.ADMIN)).toBe(true);
    expect(canManageBackup(Role.MANAGER)).toBe(false);
    expect(canManageBackup(Role.ADMIN)).toBe(true);
  });

  it("lets managers maintain the menu", () => {
    expect(canManageMenu(Role.MANAGER)).toBe(true);
    expect(canManageMenu(Role.CASHIER)).toBe(false);
  });
});
