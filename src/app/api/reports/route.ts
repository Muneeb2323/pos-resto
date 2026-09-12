import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireModule, routeError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireModule("reports");
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "today"; // today, 7days, 30days, all

    const now = new Date();
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (range === "7days") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === "30days") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === "all") {
      startDate = new Date(2020, 0, 1);
    }

    // 1. Fetch Orders in range
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      include: {
        items: true,
        payments: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    // Filter valid orders (not cancelled)
    // Cancelled and refunded orders are not takings.
    const validOrders = orders.filter(
      (o) => o.status !== "CANCELLED" && o.paymentStatus !== "REFUNDED"
    );
    const cancelledOrders = orders.filter((o) => o.status === "CANCELLED");
    const completedOrders = orders.filter((o) => o.status === "COMPLETED");
    const pendingOrders = orders.filter(
      (o) => o.status === "NEW" || o.status === "PREPARING" || o.status === "READY"
    );

    const totalSales = validOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const totalTax = validOrders.reduce((sum, o) => sum + Number(o.taxAmount), 0);
    const totalOrderCount = validOrders.length;
    const avgOrderValue = totalOrderCount > 0 ? Math.round(totalSales / totalOrderCount) : 0;

    // 3. Hourly Sales Distribution (0 to 23)
    const hourlySalesMap: Record<number, { hour: string; sales: number; orders: number }> = {};
    for (let i = 0; i < 24; i++) {
      const hour12 = i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`;
      hourlySalesMap[i] = { hour: hour12, sales: 0, orders: 0 };
    }

    for (const order of validOrders) {
      const h = new Date(order.createdAt).getHours();
      hourlySalesMap[h].sales += Number(order.grandTotal);
      hourlySalesMap[h].orders += 1;
    }

    const hourlySales = Object.values(hourlySalesMap);

    // 4. Daily Sales (last 7 days)
    const dailyMap: Record<string, { date: string; sales: number; orders: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
      dailyMap[key] = { date: key, sales: 0, orders: 0 };
    }

    for (const order of validOrders) {
      const d = new Date(order.createdAt);
      const key = d.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
      if (dailyMap[key]) {
        dailyMap[key].sales += Number(order.grandTotal);
        dailyMap[key].orders += 1;
      }
    }
    const dailySales = Object.values(dailyMap);

    // 5. Best-Selling Products
    const productMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const order of validOrders) {
      for (const item of order.items) {
        if (!productMap[item.productName]) {
          productMap[item.productName] = {
            name: item.productName,
            quantity: 0,
            revenue: 0,
          };
        }
        productMap[item.productName].quantity += item.quantity;
        productMap[item.productName].revenue += Number(item.itemTotal);
      }
    }

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);

    // 6. Order Types Breakdown
    const orderTypesMap: Record<string, number> = {
      DINE_IN: 0,
      TAKEAWAY: 0,
      PICKUP: 0,
      DELIVERY: 0,
    };
    for (const order of validOrders) {
      if (orderTypesMap[order.orderType] !== undefined) {
        orderTypesMap[order.orderType] += 1;
      }
    }
    const orderTypes = Object.entries(orderTypesMap).map(([type, count]) => ({
      name: type.replace("_", " "),
      value: count,
    }));

    // 7. Payment Methods Breakdown
    const paymentsMap: Record<string, number> = {
      CASH: 0,
      CARD: 0,
      BANK_TRANSFER: 0,
      OTHER: 0,
    };
    for (const order of validOrders) {
      for (const p of order.payments) {
        if (paymentsMap[p.paymentMethod] !== undefined) {
          paymentsMap[p.paymentMethod] += Number(p.amount);
        }
      }
    }
    const paymentMethods = Object.entries(paymentsMap).map(([method, amount]) => ({
      name: method.replace("_", " "),
      amount,
    }));

    // 8. Cashier Sales Breakdown
    const cashierMap: Record<string, { name: string; orders: number; sales: number }> = {};
    for (const order of validOrders) {
      const name = order.cashier?.name || "System";
      if (!cashierMap[name]) {
        cashierMap[name] = { name, orders: 0, sales: 0 };
      }
      cashierMap[name].orders += 1;
      cashierMap[name].sales += Number(order.grandTotal);
    }
    const cashierSales = Object.values(cashierMap);

    return NextResponse.json({
      kpis: {
        totalSales,
        totalOrders: totalOrderCount,
        avgOrderValue,
        completedOrders: completedOrders.length,
        pendingOrders: pendingOrders.length,
        cancelledOrders: cancelledOrders.length,
        totalTax,
        netIncome: totalSales,
      },
      hourlySales,
      dailySales,
      topProducts,
      orderTypes,
      paymentMethods,
      cashierSales,
      ordersList: orders.slice(0, 100),
    });
  } catch (error) {
    return routeError("reports.GET", error, "Failed to generate reports");
  }
}
