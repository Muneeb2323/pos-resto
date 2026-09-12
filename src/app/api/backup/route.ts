import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { requireRole, routeError } from "@/lib/auth/guard";
import { Prisma, Role } from "@prisma/client";

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

      /*
       * Rows are matched by identity first and by their natural key second.
       *
       * An archive restored onto a machine that already has a menu - one that was
       * seeded before the restore, say - carries the same category names and product
       * SKUs under different ids. Matching on id alone made those collide with the
       * unique indexes and failed the whole restore, so each entity is also looked up
       * by whatever uniquely identifies it to a human.
       */
      const categoryIdMap = new Map<string, string>();

      for (const category of backup.categories) {
        const existing = await tx.category.findFirst({
          where: { OR: [{ id: category.id }, { slug: category.slug }, { name: category.name }] },
        });

        const fields = {
          name: category.name,
          slug: category.slug,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          icon: category.icon ?? null,
        };

        if (existing) {
          await tx.category.update({ where: { id: existing.id }, data: fields });
          categoryIdMap.set(category.id, existing.id);
        } else {
          const created = await tx.category.create({ data: { id: category.id, ...fields } });
          categoryIdMap.set(category.id, created.id);
        }
      }

      const productIdMap = new Map<string, string>();

      for (const product of backup.products) {
        const categoryId = categoryIdMap.get(product.categoryId);
        if (!categoryId) continue; // category was not in the archive; skip the orphan

        // Null SKUs and barcodes must not be used to match, or every product without
        // one would look like the same product.
        const identifiers: Array<Record<string, string>> = [{ id: product.id }];
        if (product.sku) identifiers.push({ sku: product.sku });
        if (product.barcode) identifiers.push({ barcode: product.barcode });

        const existing = await tx.product.findFirst({ where: { OR: identifiers } });

        const fields = {
          name: product.name,
          description: product.description ?? null,
          price: product.price,
          categoryId,
          image: product.image ?? null,
          sku: product.sku ?? null,
          barcode: product.barcode ?? null,
          isActive: product.isActive,
          isAvailable: product.isAvailable,
          sortOrder: product.sortOrder,
        };

        if (existing) {
          await tx.product.update({ where: { id: existing.id }, data: fields });
          productIdMap.set(product.id, existing.id);
        } else {
          const created = await tx.product.create({ data: { id: product.id, ...fields } });
          productIdMap.set(product.id, created.id);
        }
      }

      /*
       * Option groups have no natural key, so the archive is taken as authoritative:
       * the groups of every product it describes are rebuilt from scratch. Order lines
       * keep the option name and price they were sold at, so history is unaffected.
       */
      const restoredProductIds = [...productIdMap.values()];
      if (restoredProductIds.length > 0) {
        await tx.modifierGroup.deleteMany({ where: { productId: { in: restoredProductIds } } });
      }

      const groupIdMap = new Map<string, string>();

      for (const group of backup.modifierGroups) {
        const productId = group.productId ? productIdMap.get(group.productId) : null;
        if (group.productId && !productId) continue; // belonged to a product not restored

        const created = await tx.modifierGroup.create({
          data: {
            name: group.name,
            minSelection: group.minSelection,
            maxSelection: group.maxSelection,
            isRequired: group.isRequired,
            productId: productId ?? null,
          },
        });
        groupIdMap.set(group.id, created.id);
      }

      for (const modifier of backup.modifiers) {
        const modifierGroupId = groupIdMap.get(modifier.modifierGroupId);
        if (!modifierGroupId) continue;

        await tx.modifier.create({
          data: {
            modifierGroupId,
            name: modifier.name,
            price: modifier.price,
            isAvailable: modifier.isAvailable,
          },
        });
      }

      for (const table of backup.tables) {
        const existing = await tx.restaurantTable.findFirst({
          where: { OR: [{ id: table.id }, { name: table.name }] },
        });
        if (existing) {
          await tx.restaurantTable.update({
            where: { id: existing.id },
            data: { name: table.name, capacity: table.capacity },
          });
        } else {
          // A restored table always starts free; live status is not archive data.
          await tx.restaurantTable.create({
            data: { id: table.id, name: table.name, capacity: table.capacity },
          });
        }
      }

      for (const customer of backup.customers) {
        const existing = await tx.customer.findFirst({
          where: { OR: [{ id: customer.id }, { phone: customer.phone }] },
        });
        const fields = {
          name: customer.name,
          address: customer.address ?? null,
          notes: customer.notes ?? null,
        };
        if (existing) {
          await tx.customer.update({ where: { id: existing.id }, data: fields });
        } else {
          await tx.customer.create({
            data: { id: customer.id, phone: customer.phone, ...fields },
          });
        }
      }

      for (const waiter of backup.waiters) {
        const existing = await tx.waiter.findFirst({
          where: { OR: [{ id: waiter.id }, { name: waiter.name }] },
        });
        const fields = { name: waiter.name, phone: waiter.phone ?? null, isActive: waiter.isActive };
        if (existing) {
          await tx.waiter.update({ where: { id: existing.id }, data: fields });
        } else {
          await tx.waiter.create({ data: { id: waiter.id, ...fields } });
        }
      }

      for (const rider of backup.riders) {
        const existing = await tx.rider.findFirst({
          where: { OR: [{ id: rider.id }, { name: rider.name }] },
        });
        const fields = {
          name: rider.name,
          phone: rider.phone ?? null,
          vehicleNo: rider.vehicleNo ?? null,
          isActive: rider.isActive,
        };
        if (existing) {
          await tx.rider.update({ where: { id: existing.id }, data: fields });
        } else {
          await tx.rider.create({ data: { id: rider.id, ...fields } });
        }
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
        categories: categoryIdMap.size,
        products: productIdMap.size,
        optionGroups: groupIdMap.size,
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
        " categories, with " +
        counts.optionGroups +
        " option groups. Trading history was not replayed.",
      counts,
    });
  } catch (error) {
    // P2002 means a name, SKU or barcode in the archive is already used by a different
    // row here. Saying "verify file integrity" would send the operator after the wrong
    // problem - the file is fine, the database simply already holds conflicting data.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const fields = (error.meta?.target as string[] | undefined)?.join(", ") ?? "a unique field";
      console.error("[backup.POST] restore conflict on " + fields, error);
      return NextResponse.json(
        {
          error:
            "This database already contains an item that clashes with the archive (" +
            fields +
            "). Nothing was changed. Restore into a fresh installation, or clear the " +
            "conflicting menu item first.",
        },
        { status: 409 }
      );
    }
    return routeError("backup.POST", error, "Failed to restore the archive. Nothing was changed.");
  }
}
