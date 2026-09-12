/**
 * Riders - delivery personnel shown in the POS delivery selector.
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
const MAX_VEHICLE_LENGTH = 40;

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength) || null;
}

/** GET /api/riders - active riders, or every rider with ?all=true. */
export async function GET(req: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  try {
    const includeAll = new URL(req.url).searchParams.get("all") === "true";

    const riders = await prisma.rider.findMany({
      where: includeAll ? {} : { isActive: true },
      orderBy: includeAll ? { createdAt: "asc" } : { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleNo: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(riders);
  } catch (error) {
    return routeError("riders.GET", error, "Failed to load riders");
  }
}

/** POST /api/riders - add a rider. */
export async function POST(req: NextRequest) {
  const guard = await requireModule("settings");
  if (!guard.ok) return guard.response;

  try {
    const { name, phone, vehicleNo } = (await req.json()) ?? {};
    const riderName = cleanText(name, MAX_NAME_LENGTH);
    if (!riderName) {
      return NextResponse.json({ error: "Rider name is required" }, { status: 400 });
    }

    const rider = await prisma.rider.create({
      data: {
        name: riderName,
        phone: cleanText(phone, MAX_PHONE_LENGTH),
        vehicleNo: cleanText(vehicleNo, MAX_VEHICLE_LENGTH),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleNo: true,
        isActive: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: guard.session.id,
        action: "RIDER_CREATED",
        entity: "RIDER",
        entityId: rider.id,
        details: JSON.stringify({ name: rider.name }),
      },
    });

    return NextResponse.json({ success: true, rider }, { status: 201 });
  } catch (error) {
    return routeError("riders.POST", error, "Failed to add rider");
  }
}

/** PUT /api/riders - update a rider, or toggle them active. */
export async function PUT(req: NextRequest) {
  const guard = await requireModule("settings");
  if (!guard.ok) return guard.response;

  try {
    const { id, name, phone, vehicleNo, isActive } = (await req.json()) ?? {};
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Rider ID is required" }, { status: 400 });
    }

    const existing = await prisma.rider.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Rider not found" }, { status: 404 });
    }

    // Only the fields actually supplied are touched, so the toggle in Settings cannot
    // blank out details it never sent.
    const rider = await prisma.rider.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: cleanText(name, MAX_NAME_LENGTH) ?? existing.name } : {}),
        ...(phone !== undefined ? { phone: cleanText(phone, MAX_PHONE_LENGTH) } : {}),
        ...(vehicleNo !== undefined ? { vehicleNo: cleanText(vehicleNo, MAX_VEHICLE_LENGTH) } : {}),
        ...(isActive !== undefined ? { isActive: !!isActive } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleNo: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, rider });
  } catch (error) {
    return routeError("riders.PUT", error, "Failed to update rider");
  }
}

/**
 * DELETE /api/riders?id=... - remove a rider.
 *
 * A rider who has delivered orders is deactivated rather than deleted, so historical
 * receipts keep their link. The name snapshot on each order survives either way.
 */
export async function DELETE(req: NextRequest) {
  const guard = await requireModule("settings");
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Rider ID is required" }, { status: 400 });
    }

    const existing = await prisma.rider.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Rider not found" }, { status: 404 });
    }

    if (existing._count.orders > 0) {
      await prisma.rider.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({
        success: true,
        deactivated: true,
        message:
          existing.name + " has delivered orders, so they were deactivated rather than deleted.",
      });
    }

    await prisma.rider.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: guard.session.id,
        action: "RIDER_DELETED",
        entity: "RIDER",
        entityId: id,
        details: JSON.stringify({ name: existing.name }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeError("riders.DELETE", error, "Failed to delete rider");
  }
}
