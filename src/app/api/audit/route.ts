import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireModule, routeError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireModule("audit");
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const requested = parseInt(searchParams.get("limit") || "100", 10);
    const limit = Math.min(500, Math.max(1, Number.isFinite(requested) ? requested : 100));

    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    return routeError("audit.GET", error, "Failed to fetch audit logs");
  }
}
