import { NextRequest, NextResponse } from "next/server";
import { clearAllTransactions } from "@/lib/db/purge";
import { requireRole, routeError } from "@/lib/auth/guard";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * The phrase the caller must echo back. Requiring it in the request body means a
 * stray link, a browser prefetch or a cross-site form post cannot trigger a purge -
 * only a deliberate action from the Settings screen can.
 */
const CONFIRMATION_PHRASE = "CLEAR";

/**
 * POST /api/admin/clear-transactions
 *
 * Deletes all trading history. Admin only, and deliberately POST-only: an endpoint
 * this destructive must never be reachable by navigating to a URL.
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole(Role.ADMIN);
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json().catch(() => ({}));

    if (body?.confirm !== CONFIRMATION_PHRASE) {
      return NextResponse.json(
        { error: 'Type "' + CONFIRMATION_PHRASE + '" to confirm clearing all trading history.' },
        { status: 400 }
      );
    }

    await clearAllTransactions(guard.session.id);

    return NextResponse.json({
      success: true,
      message: "Order history cleared. Menu, deals, staff and settings are unchanged.",
    });
  } catch (error) {
    return routeError("admin.clearTransactions", error, "Failed to clear trading history");
  }
}
