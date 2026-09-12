import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireModule, requireSession, routeError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  // The POS terminal reads the tax rate and receipt branding from here, so any
  // signed-in user may read settings; only Admin and Manager may change them.
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  try {
    let settings = await prisma.restaurantSettings.findUnique({
      where: { id: "singleton" },
    });

    if (!settings) {
      settings = await prisma.restaurantSettings.create({
        data: { id: "singleton" },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    return routeError("settings.GET", error, "Failed to load settings");
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireModule("settings");
  if (!guard.ok) return guard.response;
  const session = guard.session;

  try {
    const data = (await req.json()) ?? {};
    const updated = await prisma.restaurantSettings.upsert({
      where: { id: "singleton" },
      update: {
        restaurantName: data.restaurantName,
        tagline: data.tagline,
        address: data.address,
        phone: data.phone,
        currency: data.currency,
        currencySymbol: data.currencySymbol,
        taxRate: data.taxRate !== undefined ? parseFloat(data.taxRate) : undefined,
        receiptHeader: data.receiptHeader,
        receiptFooter: data.receiptFooter,
        onlinePaymentInfo:
          data.onlinePaymentInfo !== undefined
            ? String(data.onlinePaymentInfo).trim().slice(0, 500) || null
            : undefined,
        orderNumberPrefix: data.orderNumberPrefix,
        warningKitchenTime: data.warningKitchenTime ? parseInt(data.warningKitchenTime, 10) : undefined,
        criticalKitchenTime: data.criticalKitchenTime ? parseInt(data.criticalKitchenTime, 10) : undefined,
        printerName:
          typeof data.printerName === "string" ? data.printerName.trim() || undefined : undefined,
        printerType: data.printerType,
        paperWidth: data.paperWidth ? parseInt(data.paperWidth, 10) : undefined,
        autoPrintReceipt: data.autoPrintReceipt !== undefined ? !!data.autoPrintReceipt : undefined,
      },
      create: {
        id: "singleton",
        ...data,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: "SETTINGS_UPDATED",
        entity: "SETTINGS",
        entityId: "singleton",
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return routeError("settings.PUT", error, "Failed to update settings");
  }
}
