import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireModule, requireSession, routeError } from "@/lib/auth/guard";
import { MoneyError, parsePositiveMoney, toMajor } from "@/lib/money";
import { normaliseModifierGroups, planGroupSync, type NormalisedGroup } from "@/lib/menu";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const MAX_NAME_LENGTH = 120;

export async function GET(req: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search")?.trim();
    const barcode = searchParams.get("barcode")?.trim();
    const includeInactive = searchParams.get("all") === "true";

    const where: Prisma.ProductWhereInput = {};

    if (!includeInactive) {
      where.isActive = true;
    }
    if (categoryId && categoryId !== "all") {
      where.categoryId = categoryId;
    }
    if (barcode) {
      where.OR = [{ barcode }, { sku: barcode }];
    } else if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        category: { select: { id: true, name: true, slug: true } },
        modifierGroups: {
          orderBy: { createdAt: "asc" },
          include: {
            modifiers: {
              orderBy: { createdAt: "asc" },
              // The POS only offers what is in stock; the Menu editor needs to see
              // sold-out options too, or saving would silently drop them.
              where: includeInactive ? undefined : { isAvailable: true },
            },
          },
        },
      },
    });

    return NextResponse.json(products);
  } catch (error) {
    return routeError("products.GET", error, "Failed to load products");
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireModule("menu");
  if (!guard.ok) return guard.response;
  const session = guard.session;

  try {
    const data = (await req.json()) ?? {};
    const { name, description, price, categoryId, image, sku, barcode } = data;
    const isActive = data.isActive ?? true;
    const isAvailable = data.isAvailable ?? true;
    const sortOrder = data.sortOrder ?? 0;

    if (typeof name !== "string" || !name.trim() || price === undefined || !categoryId) {
      return NextResponse.json(
        { error: "Name, price, and category are required" },
        { status: 400 }
      );
    }

    const groups = normaliseModifierGroups(data.modifierGroups);

    const product = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({ where: { id: categoryId } });
      if (!category) throw new MoneyError("That category no longer exists");

      const created = await tx.product.create({
        data: {
          name: name.trim().slice(0, MAX_NAME_LENGTH),
          description: description?.trim() || null,
          price: toMajor(parsePositiveMoney(price, "Price")),
          categoryId,
          image: image || null,
          sku: sku?.trim() || null,
          barcode: barcode?.trim() || null,
          isActive: !!isActive,
          isAvailable: !!isAvailable,
          sortOrder: Number(sortOrder) || 0,
        },
      });

      for (const group of groups) {
        await createGroup(tx, created.id, group);
      }

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "PRODUCT_CREATED",
          entity: "PRODUCT",
          entityId: created.id,
          details: JSON.stringify({
            name: created.name,
            price: created.price,
            optionGroups: groups.length,
          }),
        },
      });

      return created;
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return routeError("products.POST", error, "Failed to create product");
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireModule("menu");
  if (!guard.ok) return guard.response;
  const session = guard.session;

  try {
    const data = (await req.json()) ?? {};
    const { id, name, description, price, categoryId, image, sku, barcode, isActive, isAvailable } =
      data;

    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    // `undefined` means "leave the options alone" - the availability toggle in the
    // menu list sends only { id, isAvailable } and must not wipe a deal's choices.
    const groups =
      data.modifierGroups === undefined ? null : normaliseModifierGroups(data.modifierGroups);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id },
        include: { modifierGroups: { include: { modifiers: { select: { id: true } } } } },
      });
      if (!existing) throw new NotFoundError("Product not found");

      if (categoryId) {
        const category = await tx.category.findUnique({ where: { id: categoryId } });
        if (!category) throw new MoneyError("That category no longer exists");
      }

      const newPrice = price !== undefined ? toMajor(parsePositiveMoney(price, "Price")) : undefined;

      const product = await tx.product.update({
        where: { id },
        data: {
          name: name !== undefined ? name.trim().slice(0, MAX_NAME_LENGTH) : undefined,
          description: description !== undefined ? description?.trim() || null : undefined,
          price: newPrice,
          categoryId: categoryId || undefined,
          image: image !== undefined ? image || null : undefined,
          sku: sku !== undefined ? sku?.trim() || null : undefined,
          barcode: barcode !== undefined ? barcode?.trim() || null : undefined,
          isActive: isActive !== undefined ? !!isActive : undefined,
          isAvailable: isAvailable !== undefined ? !!isAvailable : undefined,
        },
      });

      if (groups) {
        await applyGroupSync(tx, id, existing.modifierGroups, groups);
      }

      if (newPrice !== undefined && Number(existing.price) !== newPrice) {
        await tx.auditLog.create({
          data: {
            userId: session.id,
            action: "PRICE_CHANGED",
            entity: "PRODUCT",
            entityId: id,
            details: JSON.stringify({ oldPrice: existing.price, newPrice }),
          },
        });
      }

      if (groups) {
        await tx.auditLog.create({
          data: {
            userId: session.id,
            action: "PRODUCT_OPTIONS_UPDATED",
            entity: "PRODUCT",
            entityId: id,
            details: JSON.stringify({ name: product.name, optionGroups: groups.length }),
          },
        });
      }

      return product;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return routeError("products.PUT", error, "Failed to update product");
  }
}

/**
 * DELETE /api/products?id=...
 *
 * A product that appears on a past order is withdrawn from the menu rather than
 * deleted, so reports and reprinted receipts keep their link to it.
 */
export async function DELETE(req: NextRequest) {
  const guard = await requireModule("menu");
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { orderItems: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (existing._count.orderItems > 0) {
      await prisma.product.update({
        where: { id },
        data: { isActive: false, isAvailable: false },
      });

      await prisma.auditLog.create({
        data: {
          userId: guard.session.id,
          action: "PRODUCT_WITHDRAWN",
          entity: "PRODUCT",
          entityId: id,
          details: JSON.stringify({ name: existing.name, orderItems: existing._count.orderItems }),
        },
      });

      return NextResponse.json({
        success: true,
        withdrawn: true,
        message:
          existing.name +
          " has been sold before, so it was removed from the menu rather than deleted. Past orders keep their record of it.",
      });
    }

    await prisma.product.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: guard.session.id,
        action: "PRODUCT_DELETED",
        entity: "PRODUCT",
        entityId: id,
        details: JSON.stringify({ name: existing.name }),
      },
    });

    return NextResponse.json({ success: true, message: existing.name + " deleted." });
  } catch (error) {
    return routeError("products.DELETE", error, "Failed to delete product");
  }
}

class NotFoundError extends Error {}

async function createGroup(
  tx: Prisma.TransactionClient,
  productId: string,
  group: NormalisedGroup
) {
  await tx.modifierGroup.create({
    data: {
      productId,
      name: group.name,
      minSelection: group.minSelection,
      maxSelection: group.maxSelection,
      isRequired: group.isRequired,
      modifiers: {
        create: group.modifiers.map((modifier) => ({
          name: modifier.name,
          price: modifier.price,
          isAvailable: modifier.isAvailable,
        })),
      },
    },
  });
}

/** Apply the plan from `planGroupSync`, touching only what actually changed. */
async function applyGroupSync(
  tx: Prisma.TransactionClient,
  productId: string,
  existingGroups: Array<{ id: string; modifiers: Array<{ id: string }> }>,
  incoming: NormalisedGroup[]
) {
  const plan = planGroupSync(existingGroups, incoming);

  if (plan.deleteGroupIds.length > 0) {
    await tx.modifierGroup.deleteMany({ where: { id: { in: plan.deleteGroupIds } } });
  }

  for (const group of plan.createGroups) {
    await createGroup(tx, productId, group);
  }

  for (const entry of plan.updateGroups) {
    await tx.modifierGroup.update({
      where: { id: entry.id },
      data: {
        name: entry.group.name,
        minSelection: entry.group.minSelection,
        maxSelection: entry.group.maxSelection,
        isRequired: entry.group.isRequired,
      },
    });

    if (entry.deleteModifierIds.length > 0) {
      await tx.modifier.deleteMany({ where: { id: { in: entry.deleteModifierIds } } });
    }

    for (const modifier of entry.updateModifiers) {
      await tx.modifier.update({
        where: { id: modifier.id as string },
        data: {
          name: modifier.name,
          price: modifier.price,
          isAvailable: modifier.isAvailable,
        },
      });
    }

    if (entry.createModifiers.length > 0) {
      await tx.modifier.createMany({
        data: entry.createModifiers.map((modifier) => ({
          modifierGroupId: entry.id,
          name: modifier.name,
          price: modifier.price,
          isAvailable: modifier.isAvailable,
        })),
      });
    }
  }
}
