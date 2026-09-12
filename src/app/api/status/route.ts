import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { ensureAdminExists } from "@/lib/auth/bootstrap";
import { ensureLogoAssets } from "@/lib/generateIcon";

export const dynamic = "force-dynamic";

/**
 * Health probe for the status lights in the sidebar, polled every 10 seconds.
 *
 * Public by design - the login screen needs it to tell "the database is down" apart
 * from "your password is wrong" - so it reports only whether the server and database
 * are reachable, never any restaurant data.
 *
 * First-run provisioning is attempted here because this is the first request any
 * client makes; both helpers are no-ops after the first successful call.
 */
export async function GET() {
  let dbConnected = false;
  let dbError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;

    await ensureAdminExists();
    ensureLogoAssets();
  } catch (err: unknown) {
    dbConnected = false;
    // Logged in full server-side; the client is told only that the database is down.
    console.error("[status]", err);
    dbError = "Database unreachable";
  }

  return NextResponse.json({
    server: true,
    database: dbConnected,
    timestamp: new Date().toISOString(),
    error: dbError,
  });
}
