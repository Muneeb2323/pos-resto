import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireModule, routeError } from "@/lib/auth/guard";
import { OrderStatus, OrderType, PaymentMethod, Prisma, TableStatus, KitchenStatus } from "@prisma/client";
import { priceOrder, toPersistable } from "@/lib/pricing";
import { MoneyError, toMajor, toMinor } from "@/lib/money";

export const dynamic = "force-dynamic";

const MAX_PAGE_SIZE = 200;

/** Everything a receipt, ticket or order list needs, in one shape. */
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

function parsePagination(searchParams: URLSearchParams) {
  const rawLimit = parseInt(searchParams.get("limit") || "50", 10);
  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  return {
    limit: Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 50)),
    page: Math.max(1, Number.isFinite(rawPage) ? rawPage : 1),
  };
}

export async function GET(req: NextRequest) {
  const guard = await requireModule("orders");
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const orderType = searchParams.get("orderType");
    const search = searchParams.get("search")?.trim();
    const { limit, page } = parsePagination(searchParams);

    const where: Prisma.OrderWhereInput = {};

    // Filters are matched against the generated enums, so an arbitrary query string
    // can never be handed through to the database.
    if (status && status !== "ALL" && status in OrderStatus) {
      where.status = status as OrderStatus;
    }
    if (orderType && orderType !== "ALL" && orderType in OrderType) {
      where.orderType = orderType as OrderType;
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { waiterName: { contains: search, mode: "insensitive" } },
        { riderName: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { phone: { contains: search, mode: "insensitive" } } },
        { table: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
        include: ORDER_INCLUDE,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return routeError("orders.GET", error, "Failed to fetch orders");
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireModule("pos");
  if (!guard.ok) return guard.response;
  const cashier = guard.session;

  try {
    const body = await req.json();
    const {
      orderType: rawOrderType = "DINE_IN",
      tableId,
      waiterId,
      riderId,
      customer,
      items,
      discountAmount = 0,
      discountReason,
      deliveryCharge = 0,
      orderNotes,
      payment,
      grandTotal: clientGrandTotal,
    } = body ?? {};

    if (!(rawOrderType in OrderType)) {
      throw new MoneyError("Unknown order type");
    }
    const orderType = rawOrderType as OrderType;

    const newOrderId = await prisma.$transaction(async (tx) => {
      /*
       * Every figure below is recomputed from the catalogue and the restaurant's own
       * tax rate. The terminal's totals are advisory: compared for a tamper warning,
       * never persisted.
       */
      const priced = await priceOrder(tx, { orderType, items, discountAmount, deliveryCharge });
      const totals = toPersistable(priced);

      // Resolve serving staff by id, and snapshot their names onto the order so the
      // receipt still reads correctly after that person is removed from the roster.
      const waiter =
        orderType === OrderType.DINE_IN && waiterId
          ? await tx.waiter.findFirst({ where: { id: waiterId, isActive: true } })
          : null;
      if (orderType === OrderType.DINE_IN && waiterId && !waiter) {
        throw new MoneyError("The selected waiter is no longer active");
      }

      const rider =
        orderType === OrderType.DELIVERY && riderId
          ? await tx.rider.findFirst({ where: { id: riderId, isActive: true } })
          : null;
      if (orderType === OrderType.DELIVERY && riderId && !rider) {
        throw new MoneyError("The selected rider is no longer active");
      }

      let resolvedTableId: string | null = null;
      if (orderType === OrderType.DINE_IN && tableId) {
        const table = await tx.restaurantTable.findUnique({ where: { id: tableId } });
        if (!table) throw new MoneyError("The selected table no longer exists");
        resolvedTableId = table.id;
      }

      // 1. Get or create the customer.
      let customerId: string | null = null;
      const cleanPhone = typeof customer?.phone === "string" ? customer.phone.trim() : "";
      if (cleanPhone) {
        const existing = await tx.customer.findUnique({ where: { phone: cleanPhone } });

        if (existing) {
          customerId = existing.id;
          await tx.customer.update({
            where: { id: customerId },
            data: {
              name: customer.name?.trim() || existing.name,
              address: customer.address?.trim() || existing.address,
              orderCount: { increment: 1 },
              totalSpent: { increment: totals.grandTotal },
              lastOrderAt: new Date(),
            },
          });
        } else {
          const created = await tx.customer.create({
            data: {
              name: customer.name?.trim() || "Guest Customer",
              phone: cleanPhone,
              address: customer.address?.trim() || null,
              orderCount: 1,
              totalSpent: totals.grandTotal,
              lastOrderAt: new Date(),
            },
          });
          customerId = created.id;
        }
      }

      // 2. Take the next order number from the database sequence. Two terminals ringing
      //    up simultaneously can never be handed the same value, which a
      //    MAX(orderSequence) + 1 read could not guarantee.
      const sequenceRows = await tx.$queryRaw<Array<{ nextval: bigint }>>(
        Prisma.sql`SELECT nextval(pg_get_serial_sequence('"Order"', 'orderSequence')) AS nextval`
      );
      const orderSequence = Number(sequenceRows[0].nextval);

      const settings = await tx.restaurantSettings.findUnique({ where: { id: "singleton" } });
      const orderNumber = (settings?.orderNumberPrefix ?? "#") + orderSequence;

      // 3. Create the order.
      const order = await tx.order.create({
        data: {
          orderNumber,
          orderSequence,
          orderType,
          status: OrderStatus.NEW,
          tableId: resolvedTableId,
          customerId,
          cashierId: cashier.id,
          waiterId: waiter?.id ?? null,
          riderId: rider?.id ?? null,
          waiterName: waiter?.name ?? null,
          riderName: rider?.name ?? null,
          ...totals,
          discountReason:
            priced.discountMinor > 0 && typeof discountReason === "string"
              ? discountReason.trim().slice(0, 200) || null
              : null,
          paymentStatus: payment ? "PAID" : "UNPAID",
          orderNotes:
            typeof orderNotes === "string" && orderNotes.trim() ? orderNotes.trim().slice(0, 1000) : null,
          deliveryAddress:
            orderType === OrderType.DELIVERY ? customer?.address?.trim() || null : null,
          deliveryInstructions: customer?.deliveryInstructions?.trim() || null,
        },
      });

      // 4. Create the order items, freezing the prices we just computed.
      for (const item of priced.items) {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            unitPrice: toMajor(item.unitPriceMinor),
            quantity: item.quantity,
            itemTotal: toMajor(item.itemTotalMinor),
            notes: item.notes,
          },
        });

        if (item.modifiers.length > 0) {
          await tx.orderItemModifier.createMany({
            data: item.modifiers.map((modifier) => ({
              orderItemId: orderItem.id,
              modifierId: modifier.modifierId,
              modifierName: modifier.modifierName,
              unitPrice: toMajor(modifier.unitPriceMinor),
            })),
          });
        }
      }

      // 5. Kitchen ticket.
      await tx.kitchenOrder.create({ data: { orderId: order.id, status: KitchenStatus.NEW } });

      // 6. Occupy the table.
      if (resolvedTableId) {
        await tx.restaurantTable.update({
          where: { id: resolvedTableId },
          data: { status: TableStatus.OCCUPIED, currentOrderId: order.id },
        });
      }

      // 7. Record the payment, computing the change ourselves.
      if (payment) {
        if (!(payment.method in PaymentMethod)) {
          throw new MoneyError("Unknown payment method");
        }
        const method = payment.method as PaymentMethod;
        const receivedMinor =
          payment.amountReceived === undefined || payment.amountReceived === null
            ? priced.grandTotalMinor
            : toMinor(payment.amountReceived);

        if (method === PaymentMethod.CASH && receivedMinor < priced.grandTotalMinor) {
          throw new MoneyError("Cash tendered is less than the amount due");
        }
        const changeMinor = Math.max(0, receivedMinor - priced.grandTotalMinor);

        await tx.payment.create({
          data: {
            orderId: order.id,
            paymentMethod: method,
            amount: totals.grandTotal,
            amountReceived: toMajor(receivedMinor),
            changeGiven: toMajor(changeMinor),
            referenceNumber:
              typeof payment.referenceNumber === "string" ? payment.referenceNumber.trim() || null : null,
            status: "SUCCESS",
          },
        });

        if (method === PaymentMethod.CASH) {
          const activeSession = await tx.registerSession.findFirst({
            where: { status: "OPEN" },
            orderBy: { openedAt: "desc" },
          });
          if (activeSession) {
            await tx.registerSession.update({
              where: { id: activeSession.id },
              data: { cashSales: { increment: totals.grandTotal } },
            });
          }
        }
      }

      // 8. Audit. A mismatch against the terminal's own arithmetic is recorded
      //    explicitly, since it means either a stale price list or a tampered client.
      const clientTotalMinor = clientGrandTotal === undefined ? null : safeMinor(clientGrandTotal);
      const mismatched = clientTotalMinor !== null && clientTotalMinor !== priced.grandTotalMinor;

      await tx.auditLog.create({
        data: {
          userId: cashier.id,
          action: mismatched ? "ORDER_CREATED_TOTAL_MISMATCH" : "ORDER_CREATED",
          entity: "ORDER",
          entityId: order.id,
          details: JSON.stringify({
            orderNumber,
            grandTotal: totals.grandTotal,
            orderType,
            itemCount: priced.items.length,
            ...(mismatched && clientTotalMinor !== null
              ? { clientGrandTotal: toMajor(clientTotalMinor) }
              : {}),
          }),
        },
      });

      if (mismatched && clientTotalMinor !== null) {
        console.warn(
          "[orders.POST] " +
            orderNumber +
            ": terminal reported " +
            toMajor(clientTotalMinor) +
            ", server computed " +
            totals.grandTotal +
            ". Server value used."
        );
      }

      return order.id;
    });

    const order = await prisma.order.findUnique({ where: { id: newOrderId }, include: ORDER_INCLUDE });
    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) {
    return routeError("orders.POST", error, "Unable to complete order. Please try again.");
  }
}

/** Parse a client figure for comparison only; never throws. */
function safeMinor(value: unknown): number | null {
  try {
    return toMinor(value);
  } catch {
    return null;
  }
}
