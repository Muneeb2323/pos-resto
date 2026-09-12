import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export async function POST() {
  try {
    const session = await getSession();
    if (session) {
      try {
        await prisma.auditLog.create({
          data: {
            userId: session.id,
            action: "LOGOUT",
            entity: "USER",
            entityId: session.id,
          },
        });
      } catch {
        // ignore
      }
    }
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
