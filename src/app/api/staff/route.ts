/**
 * Waiters - front-of-house table service staff shown in the POS dine-in selector.
 *
 * Reading is open to anyone who can work the POS; changing the roster requires the
 * settings module (Admin or Manager).
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireModule, requireSession, routeError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const MAX_NAME_LENGTH = 80;
const MAX_PHONE_LENGTH = 32;

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || null;
}

function cleanPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, MAX_PHONE_LENGTH) || null;
}

/** GET /api/staff - active waiters, or every waiter with ?all=true. */
export async function GET(req: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  try {
    const includeAll = new URL(req.url).searchParams.get("all") === "true";

    const waiters = await prisma.waiter.findMany({
      where: includeAll ? {} : { isActive: true },
      orderBy: includeAll ? { createdAt: "asc" } : { name: "asc" },
      select: { id: true, name: true, phone: true, isActive: true, createdAt: true },
    });

    return NextResponse.json(waiters);
  } catch (error) {
    return routeError("staff.GET", error, "Failed to load waiters");
  }
}

/** POST /api/staff - add a waiter. */
export async function POST(req: NextRequest) {
  const guard = await requireModule("settings");
  if (!guard.ok) return guard.response;

  try {
    const { name, phone } = (await req.json()) ?? {};
    const waiterName = cleanName(name);
    if (!waiterName) {
      return NextResponse.json({ error: "Waiter name is required" }, { status: 400 });
    }

    const waiter = await prisma.waiter.create({
      data: { name: waiterName, phone: cleanPhone(phone) },
      select: { id: true, name: true, phone: true, isActive: true, createdAt: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: guard.session.id,
        action: "WAITER_CREATED",
        entity: "WAITER",
        entityId: waiter.id,
        details: JSON.stringify({ name: waiter.name }),
      },
    });

    return NextResponse.json({ success: true, waiter }, { status: 201 });
  } catch (error) {
    return routeError("staff.POST", error, "Failed to add waiter");
  }
}

/** PUT /api/staff - rename a waiter, change their phone, or toggle them active. */
export async function PUT(req: NextRequest) {
  const guard = await requireModule("settings");
  if (!guard.ok) return guard.response;

  try {
    const { id, name, phone, isActive } = (await req.json()) ?? {};
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Waiter ID is required" }, { status: 400 });
    }

    const existing = await prisma.waiter.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Waiter not found" }, { status: 404 });
    }

    // Only the fields actually supplied are touched, so the toggle in Settings cannot
    // blank out a name it never sent.
    const waiter = await prisma.waiter.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: cleanName(name) ?? existing.name } : {}),
        ...(phone !== undefined ? { phone: cleanPhone(phone) } : {}),
        ...(isActive !== undefined ? { isActive: !!isActive } : {}),
      },
      select: { id: true, name: true, phone: true, isActive: true, createdAt: true },
    });

    return NextResponse.json({ success: true, waiter });
  } catch (error) {
    return routeError("staff.PUT", error, "Failed to update waiter");
  }
}

/**
 * DELETE /api/staff?id=... - remove a waiter.
 *
 * A waiter who has served orders is deactivated rather than deleted, so historical
 * receipts keep their link. The name snapshot on each order survives either way.
 */
export async function DELETE(req: NextRequest) {
  const guard = await requireModule("settings");
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Waiter ID is required" }, { status: 400 });
    }

    const existing = await prisma.waiter.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Waiter not found" }, { status: 404 });
    }

    if (existing._count.orders > 0) {
      await prisma.waiter.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({
        success: true,
        deactivated: true,
        message: existing.name + " has served orders, so they were deactivated rather than deleted.",
      });
    }

    await prisma.waiter.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: guard.session.id,
        action: "WAITER_DELETED",
        entity: "WAITER",
        entityId: id,
        details: JSON.stringify({ name: existing.name }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeError("staff.DELETE", error, "Failed to delete waiter");
  }
}
