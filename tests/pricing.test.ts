import { describe, expect, it } from "vitest";
import { OrderType } from "@prisma/client";
import { priceOrder, toPersistable, type PriceOrderInput } from "@/lib/pricing";
import { MoneyError } from "@/lib/money";

/**
 * A stand-in for the Prisma transaction client, holding a small fixed menu.
 *
 * These tests exist because the terminal used to send its own totals and the server
 * stored them verbatim: a tampered request could buy a Rs. 5,000 order for Rs. 1.
 */
function makeDb(options: { taxRate?: number } = {}) {
  const burger = {
    id: "prod_burger",
    name: "Zinger Burger",
    price: "450.00",
    isActive: true,
    isAvailable: true,
    modifierGroups: [
      {
        id: "grp_extras",
        name: "Extras",
        minSelection: 0,
        maxSelection: 2,
        isRequired: false,
        modifiers: [
          { id: "mod_cheese", name: "Extra Cheese", price: "80.00", isAvailable: true },
          { id: "mod_bacon", name: "Bacon", price: "120.00", isAvailable: true },
          { id: "mod_sold_out", name: "Truffle Mayo", price: "200.00", isAvailable: false },
        ],
      },
      {
        id: "grp_size",
        name: "Size",
        minSelection: 1,
        maxSelection: 1,
        isRequired: true,
        modifiers: [
          { id: "mod_regular", name: "Regular", price: "0.00", isAvailable: true },
          { id: "mod_large", name: "Large", price: "150.00", isAvailable: true },
        ],
      },
    ],
  };

  const fries = {
    id: "prod_fries",
    name: "Loaded Fries",
    price: "320.50",
    isActive: true,
    isAvailable: true,
    modifierGroups: [],
  };

  const discontinued = {
    id: "prod_old",
    name: "Discontinued Wrap",
    price: "300.00",
    isActive: false,
    isAvailable: false,
    modifierGroups: [],
  };

  const catalogue = [burger, fries, discontinued];

  return {
    product: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        catalogue.filter((p) => where.id.in.includes(p.id)),
    },
    restaurantSettings: {
      findUnique: async () => ({ id: "singleton", taxRate: options.taxRate ?? 5 }),
    },
    // Cast: this stub implements only the slice of the client priceOrder touches.
  } as unknown as Parameters<typeof priceOrder>[0];
}

function input(partial: Partial<PriceOrderInput> = {}): PriceOrderInput {
  return {
    orderType: OrderType.TAKEAWAY,
    items: [{ productId: "prod_fries", quantity: 1 }],
    ...partial,
  };
}

describe("priceOrder", () => {
  it("prices from the catalogue, ignoring any total the caller sends", async () => {
    const priced = await priceOrder(makeDb(), input());

    expect(priced.subtotalMinor).toBe(32050);
    expect(priced.taxMinor).toBe(1603); // 5% of 320.50, rounded
    expect(priced.grandTotalMinor).toBe(33653);
    expect(toPersistable(priced)).toMatchObject({
      subtotal: 320.5,
      taxAmount: 16.03,
      grandTotal: 336.53,
    });
  });

  it("multiplies by quantity and adds modifier prices", async () => {
    const priced = await priceOrder(
      makeDb(),
      input({
        items: [
          {
            productId: "prod_burger",
            quantity: 3,
            modifiers: [{ id: "mod_cheese" }, { id: "mod_large" }],
          },
        ],
      })
    );

    // (450 + 80 + 150) * 3 = 2040
    expect(priced.subtotalMinor).toBe(204000);
    expect(priced.items[0].modifiers.map((m) => m.modifierName)).toEqual([
      "Extra Cheese",
      "Large",
    ]);
  });

  it("snapshots the catalogue name and price onto each line", async () => {
    const priced = await priceOrder(makeDb(), input());
    expect(priced.items[0]).toMatchObject({
      productName: "Loaded Fries",
      unitPriceMinor: 32050,
    });
  });

  it("rejects an item that is not on the menu", async () => {
    await expect(
      priceOrder(makeDb(), input({ items: [{ productId: "prod_ghost", quantity: 1 }] }))
    ).rejects.toThrow(MoneyError);
  });

  it("rejects an item that has been withdrawn from sale", async () => {
    await expect(
      priceOrder(makeDb(), input({ items: [{ productId: "prod_old", quantity: 1 }] }))
    ).rejects.toThrow(/no longer available/);
  });

  it("rejects a modifier belonging to a different product", async () => {
    await expect(
      priceOrder(
        makeDb(),
        input({
          items: [{ productId: "prod_fries", quantity: 1, modifiers: [{ id: "mod_cheese" }] }],
        })
      )
    ).rejects.toThrow(/Invalid option/);
  });

  it("rejects a modifier that is out of stock", async () => {
    await expect(
      priceOrder(
        makeDb(),
        input({
          items: [
            {
              productId: "prod_burger",
              quantity: 1,
              modifiers: [{ id: "mod_regular" }, { id: "mod_sold_out" }],
            },
          ],
        })
      )
    ).rejects.toThrow(/currently unavailable/);
  });

  it("enforces a required modifier group", async () => {
    await expect(
      priceOrder(makeDb(), input({ items: [{ productId: "prod_burger", quantity: 1 }] }))
    ).rejects.toThrow(/requires a selection from Size/);
  });

  it("enforces the maximum selections in a group", async () => {
    await expect(
      priceOrder(
        makeDb(),
        input({
          items: [
            {
              productId: "prod_burger",
              quantity: 1,
              modifiers: [{ id: "mod_regular" }, { id: "mod_large" }],
            },
          ],
        })
      )
    ).rejects.toThrow(/at most 1 selection/);
  });

  it("rejects a quantity that is not a whole positive number", async () => {
    for (const quantity of [0, -2, 1.5, 1000, "many"]) {
      await expect(
        priceOrder(makeDb(), input({ items: [{ productId: "prod_fries", quantity }] }))
      ).rejects.toThrow(MoneyError);
    }
  });

  it("rejects an empty cart", async () => {
    await expect(priceOrder(makeDb(), input({ items: [] }))).rejects.toThrow(/Cart is empty/);
  });

  it("applies a discount but never lets it exceed the subtotal", async () => {
    const priced = await priceOrder(makeDb(), input({ discountAmount: 20.5 }));
    expect(priced.discountMinor).toBe(2050);
    expect(priced.grandTotalMinor).toBe(32050 - 2050 + 1603);

    await expect(priceOrder(makeDb(), input({ discountAmount: 10000 }))).rejects.toThrow(
      /cannot exceed the order subtotal/
    );
  });

  it("rejects a negative discount, which would inflate the total", async () => {
    await expect(priceOrder(makeDb(), input({ discountAmount: -500 }))).rejects.toThrow(
      /cannot be negative/
    );
  });

  it("charges delivery only on delivery orders", async () => {
    const takeaway = await priceOrder(
      makeDb(),
      input({ orderType: OrderType.TAKEAWAY, deliveryCharge: 150 })
    );
    expect(takeaway.deliveryMinor).toBe(0);

    const delivery = await priceOrder(
      makeDb(),
      input({ orderType: OrderType.DELIVERY, deliveryCharge: 150 })
    );
    expect(delivery.deliveryMinor).toBe(15000);
    expect(delivery.grandTotalMinor).toBe(32050 + 1603 + 15000);
  });

  it("takes the tax rate from settings, not from the caller", async () => {
    const priced = await priceOrder(makeDb({ taxRate: 17 }), input());
    expect(priced.taxRate).toBe(17);
    expect(priced.taxMinor).toBe(5449); // 17% of 320.50
  });

  it("never produces a negative grand total", async () => {
    const priced = await priceOrder(
      makeDb({ taxRate: 0 }),
      input({ discountAmount: 320.5 })
    );
    expect(priced.grandTotalMinor).toBe(0);
  });
});
