import { describe, expect, it } from "vitest";
import {
  LINE_WIDTH,
  centerText,
  columns,
  currency,
  formatCustomerBill,
  formatKitchenTicket,
  formatOrderReceipt,
  separator,
  threeColumns,
} from "@/lib/escpos";

/** Strip ESC/POS control bytes so assertions read against the printed text. */
function printed(raw: string): string[] {
  return raw
    .replace(/\x1B[@!\-adE][\x00-\xFF]?/g, "")
    .replace(/\x1D[VW][\x00-\xFF]?/g, "")
    .split("\n");
}

const order = {
  orderNumber: "#1042",
  orderType: "DINE_IN",
  createdAt: new Date("2026-09-12T13:45:00Z"),
  table: { name: "Table 4" },
  waiterName: "Ali",
  cashier: { name: "Farhan" },
  customer: { name: "Sana", phone: "0300-1234567" },
  items: [
    {
      productName: "Zinger Burger",
      quantity: 2,
      unitPrice: "450.00",
      itemTotal: "1060.00",
      modifiers: [{ modifierName: "Extra Cheese", unitPrice: "80.00" }],
    },
    { productName: "Loaded Fries", quantity: 1, unitPrice: "320.50", itemTotal: "320.50" },
  ],
  subtotal: "1380.50",
  discountAmount: "0.00",
  taxAmount: "69.03",
  deliveryCharge: "0.00",
  grandTotal: "1449.53",
  payments: [{ paymentMethod: "CASH", amountReceived: "1500.00", changeGiven: "50.47" }],
};

describe("line layout", () => {
  it("pads two columns to exactly the paper width", () => {
    const line = columns("ITEM", "TOTAL").replace("\n", "");
    expect(line).toHaveLength(LINE_WIDTH);
    expect(line.startsWith("ITEM")).toBe(true);
    expect(line.endsWith("TOTAL")).toBe(true);
  });

  it("truncates a long left column rather than wrapping past the paper edge", () => {
    const line = columns("A".repeat(80), "999.00").replace("\n", "");
    expect(line).toHaveLength(LINE_WIDTH);
    expect(line.endsWith("999.00")).toBe(true);
  });

  it("keeps three columns within the paper width", () => {
    const line = threeColumns("QTY", "ITEM", "AMOUNT").replace("\n", "");
    expect(line).toHaveLength(LINE_WIDTH);
  });

  it("centres a heading without exceeding the paper width", () => {
    const line = centerText("FORK & FIRE").replace("\n", "");
    expect(line.length).toBeLessThanOrEqual(LINE_WIDTH);
    expect(line.trim()).toBe("FORK & FIRE");
  });

  it("draws separators the full width", () => {
    expect(separator("=").replace("\n", "")).toHaveLength(LINE_WIDTH);
  });
});

describe("currency", () => {
  it("prints whole rupees without trailing zeros", () => {
    expect(currency(1450)).toBe("Rs.1,450");
    expect(currency("320")).toBe("Rs.320");
    expect(currency(0)).toBe("Rs.0");
  });

  it("prints paisa whenever the amount actually has any", () => {
    // A receipt must never round to a figure different from the recorded sale.
    expect(currency(1449.53)).toBe("Rs.1,449.53");
    expect(currency("320.50")).toBe("Rs.320.50");
    expect(currency(50.47)).toBe("Rs.50.47");
  });

  it("falls back to zero rather than printing NaN on the customer's receipt", () => {
    expect(currency("not a number")).toBe("Rs.0");
  });
});

describe("formatOrderReceipt", () => {
  const lines = printed(formatOrderReceipt(order));
  const body = lines.join("\n");

  it("prints the order number, table and serving staff", () => {
    expect(body).toContain("#1042");
    expect(body).toContain("Table: Table 4");
    expect(body).toContain("Waiter: Ali");
    expect(body).toContain("Cashier: Farhan");
  });

  it("prints every line item with its quantity and modifiers", () => {
    expect(body).toContain("Zinger Burger");
    expect(body).toContain("2 x Rs.450");
    expect(body).toContain("Extra Cheese");
    expect(body).toContain("Loaded Fries");
  });

  it("prints totals that match the amounts the till recorded, to the paisa", () => {
    expect(body).toContain("Rs.1,380.5");
    expect(body).toContain("Rs.1,449.53");
    expect(body).toContain("Rs.50.47");
  });

  it("never emits a line wider than the paper", () => {
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(LINE_WIDTH);
    }
  });

  it("ends with a paper cut so the next ticket starts clean", () => {
    expect(formatOrderReceipt(order)).toContain("\x1DV");
  });
});

describe("customer bill: online payment accounts", () => {
  const accounts = [
    "Jazzcash: 03216303563",
    "Name: M.Abubakar zia",
    "Easypaisa: 03057729767",
    "Name: Tariq naseem",
  ].join("\n");

  it("prints the accounts under an Online Payment heading", () => {
    const body = printed(formatCustomerBill(order, { onlinePaymentInfo: accounts })).join("\n");

    expect(body).toContain("ONLINE PAYMENT");
    expect(body).toContain("Jazzcash: 03216303563");
    expect(body).toContain("Name: M.Abubakar zia");
    expect(body).toContain("Easypaisa: 03057729767");
    expect(body).toContain("Name: Tariq naseem");
  });

  it("drops the delivery contact line it replaced", () => {
    const body = printed(formatCustomerBill(order, { onlinePaymentInfo: accounts })).join("\n");
    expect(body).not.toContain("Delivery:");
  });

  it("omits the whole section when no accounts are configured", () => {
    const cases = [undefined, null, { onlinePaymentInfo: "" }, { onlinePaymentInfo: null }];
    for (const settings of cases) {
      const body = printed(formatCustomerBill(order, settings)).join("\n");
      expect(body).not.toContain("ONLINE PAYMENT");
    }
  });

  it("ignores blank lines and stray spacing in the configured text", () => {
    const messy = ["", "  Jazzcash: 0321  ", "", "", "  Name: Abu  ", ""].join("\n");
    const lines = printed(formatCustomerBill(order, { onlinePaymentInfo: messy }));

    expect(lines).toContain("Jazzcash: 0321");
    expect(lines).toContain("Name: Abu");
  });

  it("keeps a long account line within the paper width", () => {
    const lines = printed(
      formatCustomerBill(order, { onlinePaymentInfo: "Bank: " + "9".repeat(80) })
    );
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(LINE_WIDTH);
    }
  });

  it("never puts the accounts on a paid receipt", () => {
    const body = printed(formatOrderReceipt(order)).join("\n");
    expect(body).not.toContain("ONLINE PAYMENT");
    expect(body).not.toContain("Jazzcash");
  });

  it("still prints the delivery contact on the paid receipt", () => {
    // Only the customer bill traded that line for the payment accounts.
    expect(printed(formatOrderReceipt(order)).join("\n")).toContain("Delivery:");
  });
});

describe("formatCustomerBill and formatKitchenTicket", () => {
  it("print the order identity on both", () => {
    expect(printed(formatCustomerBill(order)).join("\n")).toContain("#1042");
    expect(printed(formatKitchenTicket(order)).join("\n")).toContain("#1042");
  });

  it("keep the kitchen ticket free of prices, which the kitchen does not need", () => {
    const ticket = printed(formatKitchenTicket(order)).join("\n");
    expect(ticket).toContain("Zinger Burger");
    expect(ticket).not.toContain("Rs.1,449.53");
  });

  it("stay within the paper width", () => {
    for (const raw of [formatCustomerBill(order), formatKitchenTicket(order)]) {
      for (const line of printed(raw)) {
        expect(line.length).toBeLessThanOrEqual(LINE_WIDTH);
      }
    }
  });

  it("survive an order with no items, rather than throwing at the till", () => {
    const empty = { ...order, items: [], payments: [] };
    expect(() => formatOrderReceipt(empty)).not.toThrow();
    expect(() => formatCustomerBill(empty)).not.toThrow();
    expect(() => formatKitchenTicket(empty)).not.toThrow();
  });
});
