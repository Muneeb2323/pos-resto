import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireModule, requireSession, routeError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
    });
    return NextResponse.json(categories);
  } catch (error) {
    return routeError("categories.GET", error, "Failed to load categories");
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireModule("menu");
  if (!guard.ok) return guard.response;

  try {
    const { name, icon, sortOrder } = (await req.json()) ?? {};
    if (!name?.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
        icon: icon || "utensils",
        sortOrder: Number(sortOrder) || 0,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return routeError("categories.POST", error, "Failed to create category");
  }
}
