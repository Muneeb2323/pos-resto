import prisma from "@/lib/db/prisma";

/**
 * Purges order history, transactions, tickets, register sessions and audit logs.
 *
 * Strictly preserves the catalogue and configuration:
 * - Categories (including Special Deals)
 * - Products, modifier groups and modifiers
 * - Users, waiters and riders
 * - Restaurant settings (brand, address, phone, printer)
 * - Restaurant tables (reset to AVAILABLE)
 *
 * This is destructive and irreversible. It runs only when an Admin explicitly asks
 * for it from Settings - never on a timer, a marker file, or as a side effect of a
 * page load.
 */
export async function clearAllTransactions(actorId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Detach orders from tables before deleting them.
    await tx.restaurantTable.updateMany({
      data: { status: "AVAILABLE", currentOrderId: null },
    });

    // Children first, then parents.
    await tx.orderItemModifier.deleteMany();
    await tx.orderItem.deleteMany();
    await tx.payment.deleteMany();
    await tx.kitchenOrder.deleteMany();
    await tx.order.deleteMany();

    await tx.registerSession.deleteMany();
    await tx.expense.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.customer.deleteMany();

    // Restart order numbering at #1001.
    await tx.$executeRaw`
      SELECT setval(pg_get_serial_sequence('"Order"', 'orderSequence'), 1000, true)
    `;

    // Record who did this, as the first entry of the fresh log.
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "TRANSACTIONS_PURGED",
        entity: "SYSTEM",
        entityId: "purge",
        details: JSON.stringify({ purgedAt: new Date().toISOString() }),
      },
    });
  });
}
