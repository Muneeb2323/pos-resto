import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireModule, routeError } from "@/lib/auth/guard";
import { TableStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const MAX_TABLE_NAME = 40;
const MAX_CAPACITY = 100;

export async function GET() {
  const guard = await requireModule("tables");
  if (!guard.ok) return guard.response;

  try {
    const tables = await prisma.restaurantTable.findMany({
      orderBy: { name: "asc" },
      include: {
        orders: {
          where: { status: { in: ["NEW", "PREPARING", "READY"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, orderNumber: true, grandTotal: true, createdAt: true },
        },
      },
    });
    return NextResponse.json(tables);
  } catch (error) {
    return routeError("tables.GET", error, "Failed to fetch tables");
  }
}

/** Adding or renaming tables is a floor-plan change, so it needs the settings module. */
export async function POST(req: NextRequest) {
  const guard = await requireModule("settings");
  if (!guard.ok) return guard.response;

  try {
    const { name, capacity } = (await req.json()) ?? {};
    const tableName = typeof name === "string" ? name.trim().slice(0, MAX_TABLE_NAME) : "";

    if (!tableName) {
      return NextResponse.json({ error: "Table name is required" }, { status: 400 });
    }

    const existing = await prisma.restaurantTable.findUnique({ where: { name: tableName } });
    if (existing) {
      return NextResponse.json({ error: "A table with that name already exists" }, { status: 409 });
    }

    const seats = Number(capacity);
    const table = await prisma.restaurantTable.create({
      data: {
        name: tableName,
        capacity: Number.isFinite(seats) ? Math.min(MAX_CAPACITY, Math.max(1, Math.trunc(seats))) : 4,
        status: TableStatus.AVAILABLE,
      },
    });

    return NextResponse.json(table, { status: 201 });
  } catch (error) {
    return routeError("tables.POST", error, "Failed to create table");
  }
}

/**
 * Seating a table or clearing it is ordinary floor work, so any role with the tables
 * module may do it - but a table holding a live order may not be marked free, which
 * would strand that order.
 */
export async function PATCH(req: NextRequest) {
  const guard = await requireModule("tables");
  if (!guard.ok) return guard.response;

  try {
    const { id, status, capacity } = (await req.json()) ?? {};
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Table ID is required" }, { status: 400 });
    }
    if (status !== undefined && !(status in TableStatus)) {
      return NextResponse.json({ error: "Unknown table status" }, { status: 400 });
    }

    const existing = await prisma.restaurantTable.findUnique({
      where: { id },
      include: {
        orders: {
          where: { status: { in: ["NEW", "PREPARING", "READY"] }, paymentStatus: "UNPAID" },
          select: { orderNumber: true },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    if (status === TableStatus.AVAILABLE && existing.orders.length > 0) {
      return NextResponse.json(
        {
          error:
            "Table still has the unpaid order " +
            existing.orders[0].orderNumber +
            ". Settle or cancel it before clearing the table.",
        },
        { status: 409 }
      );
    }

    const seats = Number(capacity);
    const table = await prisma.restaurantTable.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status: status as TableStatus } : {}),
        ...(capacity !== undefined && Number.isFinite(seats)
          ? { capacity: Math.min(MAX_CAPACITY, Math.max(1, Math.trunc(seats))) }
          : {}),
        ...(status === TableStatus.AVAILABLE ? { currentOrderId: null } : {}),
      },
    });

    return NextResponse.json(table);
  } catch (error) {
    return routeError("tables.PATCH", error, "Failed to update table");
  }
}
