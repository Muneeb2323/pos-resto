import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { requireRole, routeError } from "@/lib/auth/guard";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

const BACKUP_SYSTEM = "FORK & FIRE RESTAURANT POS";
const BACKUP_VERSION = "2.0";

/** Decimal columns arrive as strings in JSON; accept either and normalise. */
const money = z.union([z.number(), z.string()]).transform((value) => String(value));
const optionalText = z.string().nullable().optional();

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
  icon: optionalText,
});

const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: optionalText,
  price: money,
  categoryId: z.string().min(1),
  image: optionalText,
  sku: optionalText,
  barcode: optionalText,
  isActive: z.boolean().optional().default(true),
  isAvailable: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

const modifierGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  minSelection: z.number().int().optional().default(0),
  maxSelection: z.number().int().optional().default(1),
  isRequired: z.boolean().optional().default(false),
  productId: z.string().nullable().optional(),
});

const modifierSchema = z.object({
  id: z.string().min(1),
  modifierGroupId: z.string().min(1),
  name: z.string().min(1),
  price: money,
  isAvailable: z.boolean().optional().default(true),
});

const tableSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  capacity: z.number().int().min(1).max(100).optional().default(4),
});

const customerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  address: optionalText,
  notes: optionalText,
});

const staffSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  phone: optionalText,
  vehicleNo: optionalText,
  isActive: z.boolean().optional().default(true),
});

const settingsSchema = z
  .object({
    restaurantName: z.string().optional(),
    tagline: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    currency: z.string().optional(),
    currencySymbol: z.string().optional(),
    taxRate: money.optional(),
    receiptHeader: z.string().optional(),
    receiptFooter: z.string().optional(),
    onlinePaymentInfo: z.string().nullable().optional(),
    orderNumberPrefix: z.string().optional(),
    warningKitchenTime: z.number().int().optional(),
    criticalKitchenTime: z.number().int().optional(),
    printerName: z.string().optional(),
    printerType: z.string().optional(),
    paperWidth: z.number().int().optional(),
    autoPrintReceipt: z.boolean().optional(),
  })
  .nullable()
  .optional();

/**
 * An archive is validated field by field before a single row is touched.
 *
 * The previous implementation spread raw objects from the file straight into Prisma
 * `create` calls, so a hand-edited archive could set any column on any row.
 */
const backupSchema = z.object({
  meta: z.object({
    system: z.string().refine((value) => value.includes("FORK & FIRE"), {
      message: "Not a Fork & Fire archive",
    }),
    version: z.string().optional(),
    exportDate: z.string().optional(),
    exportedBy: z.string().optional(),
  }),
  settings: settingsSchema,
  categories: z.array(categorySchema).optional().default([]),
  products: z.array(productSchema).optional().default([]),
  modifierGroups: z.array(modifierGroupSchema).optional().default([]),
  modifiers: z.array(modifierSchema).optional().default([]),
  tables: z.array(tableSchema).optional().default([]),
  customers: z.array(customerSchema).optional().default([]),
  waiters: z.array(staffSchema).optional().default([]),
  riders: z.array(staffSchema).optional().default([]),
});

/** GET /api/backup - download a full archive. */
export async function GET() {
  const guard = await requireRole(Role.ADMIN);
  if (!guard.ok) return guard.response;

  try {
    const [
      settings,
      categories,
      products,
      modifierGroups,
      modifiers,
      tables,
      customers,
      waiters,
      riders,
      orders,
    ] = await Promise.all([
      prisma.restaurantSettings.findUnique({ where: { id: "singleton" } }),
      prisma.category.findMany(),
      prisma.product.findMany(),
      prisma.modifierGroup.findMany(),
      prisma.modifier.findMany(),
      prisma.restaurantTable.findMany(),
      prisma.customer.findMany(),
      prisma.waiter.findMany(),
      prisma.rider.findMany(),
      prisma.order.findMany({ include: { items: { include: { modifiers: true } }, payments: true } }),
    ]);

    const backupData = {
      meta: {
        system: BACKUP_SYSTEM,
        version: BACKUP_VERSION,
        exportDate: new Date().toISOString(),
        exportedBy: guard.session.username,
      },
      settings,
      categories,
      products,
      modifierGroups,
      modifiers,
      tables,
      customers,
      waiters,
      riders,
      // Trading history is included for archival and audit. Restore deliberately does
      // not replay it into a live till - see POST below.
      orders,
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const filename = "fork_and_fire_backup_" + new Date().toISOString().slice(0, 10) + ".json";

    try {
      await prisma.backupRecord.create({
        data: {
          filename,
          fileSize: Buffer.byteLength(jsonString),
          recordCount: products.length + orders.length,
          status: "SUCCESS",
        },
      });
    } catch {
      // The archive is already built; failing to log it must not fail the download.
    }

    return new NextResponse(jsonString, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="' + filename + '"',
      },
    });
  } catch (error) {
    return routeError("backup.GET", error, "Failed to create backup");
  }
}

/**
 * POST /api/backup - restore the menu and configuration from an archive.
 *
 * Restores the catalogue, floor plan, staff roster, customers and settings. Trading
 * history is intentionally *not* replayed: merging old orders and payments into a till
 * that is already trading would corrupt order numbering and double-count takings. The
 * history remains readable in the archive file for audit.
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole(Role.ADMIN);
  if (!guard.ok) return guard.response;

  try {
    const raw = await req.json().catch(() => null);
    if (raw === null) {
      return NextResponse.json({ error: "Backup file is not valid JSON" }, { status: 400 });
    }

    const parsed = backupSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        {
          error:
            "Invalid backup archive: " +
            (first ? first.path.join(".") + " - " + first.message : "unrecognised format"),
        },
        { status: 400 }
      );
    }

    const backup = parsed.data;

    const counts = await prisma.$transaction(async (tx) => {
      if (backup.settings) {
        await tx.restaurantSettings.upsert({
          where: { id: "singleton" },
          update: backup.settings,
          create: { id: "singleton", ...backup.settings },
        });
      }

      // Parents before children, so foreign keys always resolve.
      for (const category of backup.categories) {
        await tx.category.upsert({
          where: { id: category.id },
          update: {
            name: category.name,
            slug: category.slug,
            sortOrder: category.sortOrder,
            isActive: category.isActive,
            icon: category.icon ?? null,
          },
          create: {
            id: category.id,
            name: category.name,
            slug: category.slug,
            sortOrder: category.sortOrder,
            isActive: category.isActive,
            icon: category.icon ?? null,
          },
        });
      }

      const knownCategoryIds = new Set((await tx.category.findMany({ select: { id: true } })).map((c) => c.id));

      for (const product of backup.products) {
        if (!knownCategoryIds.has(product.categoryId)) continue; // orphan, skip rather than fail
        const fields = {
          name: product.name,
          description: product.description ?? null,
          price: product.price,
          categoryId: product.categoryId,
          image: product.image ?? null,
          sku: product.sku ?? null,
          barcode: product.barcode ?? null,
          isActive: product.isActive,
          isAvailable: product.isAvailable,
          sortOrder: product.sortOrder,
        };
        await tx.product.upsert({
          where: { id: product.id },
          update: fields,
          create: { id: product.id, ...fields },
        });
      }

      const knownProductIds = new Set((await tx.product.findMany({ select: { id: true } })).map((p) => p.id));

      for (const group of backup.modifierGroups) {
        if (group.productId && !knownProductIds.has(group.productId)) continue;
        const fields = {
          name: group.name,
          minSelection: group.minSelection,
          maxSelection: group.maxSelection,
          isRequired: group.isRequired,
          productId: group.productId ?? null,
        };
        await tx.modifierGroup.upsert({
          where: { id: group.id },
          update: fields,
          create: { id: group.id, ...fields },
        });
      }

      const knownGroupIds = new Set(
        (await tx.modifierGroup.findMany({ select: { id: true } })).map((g) => g.id)
      );

      for (const modifier of backup.modifiers) {
        if (!knownGroupIds.has(modifier.modifierGroupId)) continue;
        const fields = {
          modifierGroupId: modifier.modifierGroupId,
          name: modifier.name,
          price: modifier.price,
          isAvailable: modifier.isAvailable,
        };
        await tx.modifier.upsert({
          where: { id: modifier.id },
          update: fields,
          create: { id: modifier.id, ...fields },
        });
      }

      for (const table of backup.tables) {
        await tx.restaurantTable.upsert({
          where: { id: table.id },
          update: { name: table.name, capacity: table.capacity },
          // A restored table always starts free; its live status is not archive data.
          create: { id: table.id, name: table.name, capacity: table.capacity },
        });
      }

      for (const customer of backup.customers) {
        await tx.customer.upsert({
          where: { id: customer.id },
          update: {
            name: customer.name,
            address: customer.address ?? null,
            notes: customer.notes ?? null,
          },
          create: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            address: customer.address ?? null,
            notes: customer.notes ?? null,
          },
        });
      }

      for (const waiter of backup.waiters) {
        await tx.waiter.upsert({
          where: { id: waiter.id },
          update: { name: waiter.name, phone: waiter.phone ?? null, isActive: waiter.isActive },
          create: {
            id: waiter.id,
            name: waiter.name,
            phone: waiter.phone ?? null,
            isActive: waiter.isActive,
          },
        });
      }

      for (const rider of backup.riders) {
        await tx.rider.upsert({
          where: { id: rider.id },
          update: {
            name: rider.name,
            phone: rider.phone ?? null,
            vehicleNo: rider.vehicleNo ?? null,
            isActive: rider.isActive,
          },
          create: {
            id: rider.id,
            name: rider.name,
            phone: rider.phone ?? null,
            vehicleNo: rider.vehicleNo ?? null,
            isActive: rider.isActive,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: guard.session.id,
          action: "DATABASE_RESTORED",
          entity: "SYSTEM",
          entityId: "backup",
          details: JSON.stringify({
            sourceDate: backup.meta.exportDate ?? null,
            products: backup.products.length,
            categories: backup.categories.length,
          }),
        },
      });

      return {
        categories: backup.categories.length,
        products: backup.products.length,
        tables: backup.tables.length,
        customers: backup.customers.length,
        waiters: backup.waiters.length,
        riders: backup.riders.length,
      };
    });

    return NextResponse.json({
      success: true,
      message:
        "Restored " +
        counts.products +
        " products across " +
        counts.categories +
        " categories. Trading history was not replayed.",
      counts,
    });
  } catch (error) {
    return routeError("backup.POST", error, "Failed to restore backup archive. Verify file integrity.");
  }
}
