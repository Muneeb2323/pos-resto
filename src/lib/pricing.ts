/**
 * Authoritative order pricing.
 *
 * The POS terminal computes totals locally so the cashier sees them instantly, but
 * those numbers are a *display hint only*. Every figure that reaches the database is
 * recomputed here from the catalogue and the restaurant's configured tax rate, so a
 * tampered or stale client cannot alter what the restaurant is paid.
 */
import { Prisma, OrderType } from "@prisma/client";
import { MoneyError, parsePositiveMoney, percentOf, toMajor, toMinor } from "@/lib/money";

/** Prisma client or interactive-transaction client. */
type Db = Prisma.TransactionClient;

const MAX_QUANTITY = 999;
const MAX_ITEMS_PER_ORDER = 200;

export interface CartItemInput {
  productId?: string | null;
  quantity?: unknown;
  notes?: string | null;
  modifiers?: Array<{ id?: string | null }> | null;
}

export interface PriceOrderInput {
  orderType: OrderType;
  items: CartItemInput[];
  discountAmount?: unknown;
  deliveryCharge?: unknown;
}

export interface PricedModifier {
  modifierId: string;
  modifierName: string;
  unitPriceMinor: number;
}

export interface PricedItem {
  productId: string;
  productName: string;
  unitPriceMinor: number;
  quantity: number;
  itemTotalMinor: number;
  notes: string | null;
  modifiers: PricedModifier[];
}

export interface PricedOrder {
  items: PricedItem[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  deliveryMinor: number;
  grandTotalMinor: number;
  taxRate: number;
}

/** Totals as 2-decimal numbers, ready to hand to Prisma's Decimal columns. */
export function toPersistable(priced: PricedOrder) {
  return {
    subtotal: toMajor(priced.subtotalMinor),
    discountAmount: toMajor(priced.discountMinor),
    taxAmount: toMajor(priced.taxMinor),
    deliveryCharge: toMajor(priced.deliveryMinor),
    grandTotal: toMajor(priced.grandTotalMinor),
  };
}

function parseQuantity(value: unknown): number {
  const quantity = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new MoneyError(`Quantity must be a whole number between 1 and ${MAX_QUANTITY}`);
  }
  return quantity;
}

/**
 * Recompute an order from the catalogue.
 *
 * Prices, modifier prices and the tax rate are read from the database; only the
 * product identity, quantity, notes, discount and delivery charge come from the caller.
 */
export async function priceOrder(db: Db, input: PriceOrderInput): Promise<PricedOrder> {
  const { items, orderType } = input;

  if (!Array.isArray(items) || items.length === 0) {
    throw new MoneyError("Cart is empty");
  }
  if (items.length > MAX_ITEMS_PER_ORDER) {
    throw new MoneyError(`An order cannot contain more than ${MAX_ITEMS_PER_ORDER} lines`);
  }

  // Load every referenced product once, with the modifier groups that are legal for it.
  const productIds = [...new Set(items.map((i) => i.productId).filter((id): id is string => !!id))];
  if (productIds.length === 0) {
    throw new MoneyError("Order items must reference catalogue products");
  }

  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: { modifierGroups: { include: { modifiers: true } } },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const pricedItems: PricedItem[] = [];
  let subtotalMinor = 0;

  for (const item of items) {
    if (!item.productId) {
      throw new MoneyError("Order items must reference catalogue products");
    }
    const product = productById.get(item.productId);
    if (!product) {
      throw new MoneyError("One or more items are no longer on the menu");
    }
    if (!product.isActive || !product.isAvailable) {
      throw new MoneyError(`"${product.name}" is no longer available`);
    }

    const quantity = parseQuantity(item.quantity);
    const unitPriceMinor = toMinor(product.price);

    // Only modifiers belonging to this product's own groups may be attached.
    const legalModifiers = new Map(
      product.modifierGroups.flatMap((group) =>
        group.modifiers.map((modifier) => [modifier.id, { modifier, group }] as const)
      )
    );

    const requested = Array.isArray(item.modifiers) ? item.modifiers : [];
    const pricedModifiers: PricedModifier[] = [];
    const perGroupCount = new Map<string, number>();
    let modifierTotalMinor = 0;

    for (const requestedModifier of requested) {
      const modifierId = requestedModifier?.id;
      if (!modifierId) continue;

      const match = legalModifiers.get(modifierId);
      if (!match) {
        throw new MoneyError(`Invalid option selected for "${product.name}"`);
      }
      if (!match.modifier.isAvailable) {
        throw new MoneyError(`"${match.modifier.name}" is currently unavailable`);
      }

      const count = (perGroupCount.get(match.group.id) ?? 0) + 1;
      perGroupCount.set(match.group.id, count);

      const modifierPriceMinor = toMinor(match.modifier.price);
      modifierTotalMinor += modifierPriceMinor;
      pricedModifiers.push({
        modifierId: match.modifier.id,
        modifierName: match.modifier.name,
        unitPriceMinor: modifierPriceMinor,
      });
    }

    // Enforce the group rules the menu defines, rather than trusting the terminal.
    for (const group of product.modifierGroups) {
      const chosen = perGroupCount.get(group.id) ?? 0;
      if (group.isRequired && chosen < Math.max(1, group.minSelection)) {
        throw new MoneyError(`"${product.name}" requires a selection from ${group.name}`);
      }
      if (chosen > 0 && chosen < group.minSelection) {
        throw new MoneyError(`${group.name} needs at least ${group.minSelection} selection(s)`);
      }
      if (group.maxSelection > 0 && chosen > group.maxSelection) {
        throw new MoneyError(`${group.name} allows at most ${group.maxSelection} selection(s)`);
      }
    }

    const itemTotalMinor = (unitPriceMinor + modifierTotalMinor) * quantity;
    subtotalMinor += itemTotalMinor;

    pricedItems.push({
      productId: product.id,
      productName: product.name,
      unitPriceMinor,
      quantity,
      itemTotalMinor,
      notes: typeof item.notes === "string" && item.notes.trim() ? item.notes.trim().slice(0, 500) : null,
      modifiers: pricedModifiers,
    });
  }

  // A discount may never exceed the subtotal, or the order could go negative.
  const requestedDiscountMinor = parsePositiveMoney(input.discountAmount ?? 0, "Discount");
  if (requestedDiscountMinor > subtotalMinor) {
    throw new MoneyError("Discount cannot exceed the order subtotal");
  }
  const discountMinor = requestedDiscountMinor;

  // Delivery applies to delivery orders only, whatever the caller claims.
  const deliveryMinor =
    orderType === OrderType.DELIVERY ? parsePositiveMoney(input.deliveryCharge ?? 0, "Delivery charge") : 0;

  // Tax rate is the restaurant's, never the caller's.
  const settings = await db.restaurantSettings.findUnique({ where: { id: "singleton" } });
  const taxRate = settings ? Number(settings.taxRate) : 0;
  const taxMinor = percentOf(subtotalMinor, taxRate);

  const grandTotalMinor = Math.max(0, subtotalMinor - discountMinor + taxMinor + deliveryMinor);

  return {
    items: pricedItems,
    subtotalMinor,
    discountMinor,
    taxMinor,
    deliveryMinor,
    grandTotalMinor,
    taxRate,
  };
}
