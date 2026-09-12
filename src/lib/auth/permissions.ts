import { Role } from "@prisma/client";

export type AppModule =
  | "dashboard"
  | "pos"
  | "orders"
  | "kitchen"
  | "menu"
  | "customers"
  | "tables"
  | "reports"
  | "register"
  | "expenses"
  | "staff"
  | "settings"
  | "audit"
  | "backup";

const ROLE_PERMISSIONS: Record<Role, AppModule[]> = {
  ADMIN: [
    "dashboard",
    "pos",
    "orders",
    "kitchen",
    "menu",
    "customers",
    "tables",
    "reports",
    "register",
    "expenses",
    "staff",
    "settings",
    "audit",
    "backup",
  ],
  MANAGER: [
    "dashboard",
    "pos",
    "orders",
    "kitchen",
    "menu",
    "customers",
    "tables",
    "reports",
    "register",
    "expenses",
    "settings",
    "audit",
  ],
  CASHIER: [
    "pos",
    "orders",
    "kitchen",
    "customers",
    "tables",
    "register",
  ],
  KITCHEN: [
    "kitchen",
  ],
};

export function canAccessModule(role: Role, module: AppModule): boolean {
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(module);
}

export function canCancelOrder(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export function canRefundPayment(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export function canManageStaff(role: Role): boolean {
  return role === "ADMIN";
}

export function canManageSettings(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export function canManageBackup(role: Role): boolean {
  return role === "ADMIN";
}

export function canManageMenu(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGER";
}
