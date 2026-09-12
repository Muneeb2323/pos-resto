import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireModule, requireSession, routeError } from "@/lib/auth/guard";
import { canCancelOrder, canRefundPayment } from "@/lib/auth/permissions";
import { PaymentMethod, Prisma, TableStatus } from "@prisma/client";
import { MoneyError, toMajor, toMinor } from "@/lib/money";

export const dynamic = "force-dynamic";

const ORDER_INCLUDE = {
  customer: true,
  table: true,
  cashier: { select: { id: true, name: true, username: true } },
  waiter: { select: { id: true, name: true } },
  rider: { select: { id: true, name: true, phone: true, vehicleNo: true } },
  items: { include: { modifiers: true } },
  payments: true,
  kitchenOrder: true,
} satisfies Prisma.OrderInclude;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireModule("orders");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (error) {
    return routeError("orders.[id].GET", error, "Failed to fetch order");
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const session = guard.session;

  try {
    const { id } = await params;
    const body = await req.json();
    const { action, reason } = body ?? {};

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: { table: true, payments: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (action === "CANCEL") {
      if (!canCancelOrder(session.role)) {
        return NextResponse.json(
          { error: "Only Managers and Admins can cancel orders" },
          { status: 403 }
        );
      }
      if (existingOrder.status === "CANCELLED") {
        return NextResponse.json({ error: "Order is already cancelled" }, { status: 400 });
      }
      if (existingOrder.paymentStatus === "PAID") {
        return NextResponse.json(
          { error: "This order is already paid. Process a refund instead of a cancellation." },
          { status: 400 }
        );
      }

      const cancellationNote = typeof reason === "string" ? reason.trim().slice(0, 200) : "";

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id },
          data: {
            status: "CANCELLED",
            orderNotes: cancellationNote
              ? [existingOrder.orderNotes, "[CANCELLED: " + cancellationNote + "]"]
                  .filter(Boolean)
                  .join("\n")
              : existingOrder.orderNotes,
          },
        });

        if (existingOrder.tableId) {
          await tx.restaurantTable.update({
            where: { id: existingOrder.tableId },
            data: { status: TableStatus.AVAILABLE, currentOrderId: null },
          });
        }

        await tx.kitchenOrder.updateMany({
          where: { orderId: id },
          data: { status: "COMPLETED" },
        });

        await tx.auditLog.create({
          data: {
            userId: session.id,
            action: "ORDER_CANCELLED",
            entity: "ORDER",
            entityId: id,
            details: JSON.stringify({ reason: cancellationNote || null }),
          },
        });
      });

      return NextResponse.json({ success: true, message: "Order cancelled successfully" });
    }

    if (action === "REFUND") {
      if (!canRefundPayment(session.role)) {
        return NextResponse.json(
          { error: "Only Managers and Admins can process refunds" },
          { status: 403 }
        );
      }
      if (existingOrder.paymentStatus === "REFUNDED") {
        return NextResponse.json({ error: "Order has already been refunded" }, { status: 400 });
      }
      if (existingOrder.paymentStatus !== "PAID") {
        return NextResponse.json(
          { error: "Only a paid order can be refunded" },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id },
          data: { paymentStatus: "REFUNDED", status: "CANCELLED" },
        });

        await tx.payment.updateMany({ where: { orderId: id }, data: { status: "REFUNDED" } });

        if (existingOrder.tableId) {
          await tx.restaurantTable.update({
            where: { id: existingOrder.tableId },
            data: { status: TableStatus.AVAILABLE, currentOrderId: null },
          });
        }

        // Reverse the customer's lifetime spend, which the sale incremented.
        if (existingOrder.customerId) {
          await tx.customer.update({
            where: { id: existingOrder.customerId },
            data: {
              totalSpent: { decrement: existingOrder.grandTotal },
              orderCount: { decrement: 1 },
            },
          });
        }

        const hasCash = existingOrder.payments.some((p) => p.paymentMethod === PaymentMethod.CASH);
        if (hasCash) {
          const activeSession = await tx.registerSession.findFirst({
            where: { status: "OPEN" },
            orderBy: { openedAt: "desc" },
          });
          if (activeSession) {
            await tx.registerSession.update({
              where: { id: activeSession.id },
              data: { cashRefunds: { increment: existingOrder.grandTotal } },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            userId: session.id,
            action: "ORDER_REFUNDED",
            entity: "ORDER",
            entityId: id,
            details: JSON.stringify({
              amount: existingOrder.grandTotal,
              reason: typeof reason === "string" ? reason.trim().slice(0, 200) || null : null,
            }),
          },
        });
      });

      return NextResponse.json({ success: true, message: "Order refunded successfully" });
    }

    if (action === "MARK_PAID") {
      const { paymentMethod = "CASH", amountReceived, referenceNumber } = body ?? {};

      if (existingOrder.paymentStatus === "PAID") {
        return NextResponse.json({ error: "Order is already paid" }, { status: 400 });
      }
      if (existingOrder.status === "CANCELLED") {
        return NextResponse.json({ error: "A cancelled order cannot be paid" }, { status: 400 });
      }
      if (!(paymentMethod in PaymentMethod)) {
        throw new MoneyError("Unknown payment method");
      }

      const method = paymentMethod as PaymentMethod;

      // The amount due is whatever the order says it is; only the cash tendered comes
      // from the terminal, and the change is derived here rather than trusted.
      const dueMinor = toMinor(existingOrder.grandTotal);
      const receivedMinor =
        amountReceived === undefined || amountReceived === null ? dueMinor : toMinor(amountReceived);

      if (method === PaymentMethod.CASH && receivedMinor < dueMinor) {
        throw new MoneyError("Cash tendered is less than the amount due");
      }
      const changeMinor = Math.max(0, receivedMinor - dueMinor);

      const updatedOrder = await prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            orderId: id,
            paymentMethod: method,
            amount: toMajor(dueMinor),
            amountReceived: toMajor(receivedMinor),
            changeGiven: toMajor(changeMinor),
            referenceNumber:
              typeof referenceNumber === "string" ? referenceNumber.trim() || null : null,
            status: "SUCCESS",
          },
        });

        const order = await tx.order.update({
          where: { id },
          data: { paymentStatus: "PAID" },
          include: ORDER_INCLUDE,
        });

        if (method === PaymentMethod.CASH) {
          const activeSession = await tx.registerSession.findFirst({
            where: { status: "OPEN" },
            orderBy: { openedAt: "desc" },
          });
          if (activeSession) {
            await tx.registerSession.update({
              where: { id: activeSession.id },
              data: { cashSales: { increment: order.grandTotal } },
            });
          }
        }

        if (existingOrder.tableId) {
          await tx.restaurantTable.update({
            where: { id: existingOrder.tableId },
            data: { status: TableStatus.AVAILABLE, currentOrderId: null },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: session.id,
            action: "ORDER_PAID",
            entity: "ORDER",
            entityId: id,
            details: JSON.stringify({
              paymentMethod: method,
              amount: toMajor(dueMinor),
              amountReceived: toMajor(receivedMinor),
              changeGiven: toMajor(changeMinor),
            }),
          },
        });

        return order;
      });

      return NextResponse.json({
        success: true,
        message: "Order marked as PAID successfully",
        order: updatedOrder,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return routeError("orders.[id].PATCH", error, "Failed to update order");
  }
}
