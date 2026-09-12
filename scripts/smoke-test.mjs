/**
 * End-to-end smoke test against a running POS server.
 *
 * Exercises the paths that handle money and authority, against real HTTP and a real
 * database - the parts the unit suite in tests/ cannot reach. Run it after starting
 * the server:
 *
 *   npm run start          (or npm run dev)
 *   npm run smoke
 *
 * It creates one order, settles it, then deletes what it created.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const USERNAME = process.env.ADMIN_USERNAME || "admin";
const PASSWORD = process.env.ADMIN_PASSWORD;

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
const createdOrderIds = [];
const createdProductIds = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log("  PASS  " + name);
  } else {
    failed += 1;
    console.log("  FAIL  " + name + (detail ? "  -> " + detail : ""));
  }
}

function section(title) {
  console.log("\n" + title);
  console.log("-".repeat(title.length));
}

let cookie = "";

async function api(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {}),
    },
    redirect: "manual",
  });
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, res };
}

async function main() {
  if (!PASSWORD) {
    console.error("ADMIN_PASSWORD is not set in .env - cannot sign in.");
    process.exitCode = 1;
    return;
  }

  section("Server reachable");
  const status = await api("/api/status");
  check("GET /api/status returns 200", status.status === 200, "got " + status.status);
  check("database is connected", status.body?.database === true);
  if (status.status !== 200) {
    console.error("\nServer is not running at " + BASE + ". Start it with `npm run start`.");
    process.exitCode = 1;
    return;
  }

  section("Unauthenticated access is refused");
  for (const path of [
    "/api/orders",
    "/api/products",
    "/api/tables",
    "/api/staff",
    "/api/riders",
    "/api/reports",
    "/api/settings",
    "/api/audit",
    "/api/backup",
  ]) {
    const r = await api(path);
    check("GET " + path + " -> 401", r.status === 401, "got " + r.status);
  }

  const purgeGet = await api("/api/admin/clear-transactions");
  check(
    "GET /api/admin/clear-transactions is not a route at all (405)",
    purgeGet.status === 405 || purgeGet.status === 401,
    "got " + purgeGet.status
  );

  const purgePost = await api("/api/admin/clear-transactions", { method: "POST" });
  check(
    "POST /api/admin/clear-transactions without a session -> 401",
    purgePost.status === 401,
    "got " + purgePost.status
  );

  section("Sign-in");
  const badLogin = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: USERNAME, password: "definitely-not-the-password" }),
  });
  check("wrong password -> 401", badLogin.status === 401, "got " + badLogin.status);
  check(
    "error message does not reveal whether the user exists",
    badLogin.body?.error === "Invalid username or password",
    JSON.stringify(badLogin.body)
  );

  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  check("correct password -> 200", login.status === 200, JSON.stringify(login.body));

  const setCookie = login.res.headers.get("set-cookie") || "";
  cookie = setCookie.split(";")[0];
  check("session cookie issued", cookie.startsWith("fork_fire_session="));
  check("session cookie is HttpOnly", /HttpOnly/i.test(setCookie));
  check("session cookie is SameSite", /SameSite/i.test(setCookie));

  section("Authenticated reads");
  const products = await api("/api/products");
  check("GET /api/products -> 200", products.status === 200);
  check("menu has products", Array.isArray(products.body) && products.body.length > 0);

  const settings = await api("/api/settings");
  check("GET /api/settings -> 200", settings.status === 200);
  const taxRate = Number(settings.body?.taxRate ?? 0);

  const staff = await api("/api/staff");
  check("GET /api/staff -> 200", staff.status === 200);

  section("Order pricing is computed by the server");
  const product = products.body.find((p) => !p.modifierGroups?.some((g) => g.isRequired));
  check("found a product with no required options", !!product, "none available");
  if (!product) return;

  const unitPrice = Number(product.price);
  const quantity = 2;
  const expectedSubtotal = Math.round(unitPrice * 100) * quantity;
  const expectedTax = Math.round((expectedSubtotal * taxRate) / 100);
  const expectedTotal = (expectedSubtotal + expectedTax) / 100;

  // The critical case: the terminal claims the order costs one rupee.
  const tampered = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      orderType: "TAKEAWAY",
      items: [{ productId: product.id, quantity, name: "spoofed", price: 0.01 }],
      subtotal: 1,
      taxAmount: 0,
      grandTotal: 1,
      payment: null,
    }),
  });
  check("tampered order is accepted but repriced", tampered.status === 201, JSON.stringify(tampered.body));

  const order = tampered.body?.order;
  if (order) {
    createdOrderIds.push(order.id);
    check(
      "grandTotal is the catalogue price, not the claimed Rs. 1",
      Number(order.grandTotal) === expectedTotal,
      "expected " + expectedTotal + ", stored " + order.grandTotal
    );
    check(
      "subtotal is recomputed",
      Number(order.subtotal) === expectedSubtotal / 100,
      "expected " + expectedSubtotal / 100 + ", stored " + order.subtotal
    );
    check(
      "line price is the catalogue price, not the claimed 0.01",
      Number(order.items[0].unitPrice) === unitPrice,
      "stored " + order.items[0]?.unitPrice
    );
    check(
      "line name is the catalogue name, not the claimed one",
      order.items[0].productName === product.name,
      "stored " + order.items[0]?.productName
    );
    check("order number was issued", typeof order.orderNumber === "string" && order.orderNumber.length > 1);
    check("kitchen ticket was raised", !!order.kitchenOrder);
    check("cashier recorded", !!order.cashierId);

    const auditEntry = await prisma.auditLog.findFirst({
      where: { entityId: order.id, action: "ORDER_CREATED_TOTAL_MISMATCH" },
    });
    check("the total mismatch was written to the audit log", !!auditEntry);
  }

  section("Order validation");
  const emptyCart = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({ orderType: "TAKEAWAY", items: [] }),
  });
  check("empty cart -> 400", emptyCart.status === 400, "got " + emptyCart.status);

  const negativeDiscount = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      orderType: "TAKEAWAY",
      items: [{ productId: product.id, quantity: 1 }],
      discountAmount: -5000,
    }),
  });
  check("negative discount -> 400", negativeDiscount.status === 400, "got " + negativeDiscount.status);

  const hugeDiscount = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      orderType: "TAKEAWAY",
      items: [{ productId: product.id, quantity: 1 }],
      discountAmount: 9_000_000,
    }),
  });
  check("discount above subtotal -> 400", hugeDiscount.status === 400, "got " + hugeDiscount.status);

  const ghostProduct = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      orderType: "TAKEAWAY",
      items: [{ productId: "does-not-exist", quantity: 1 }],
    }),
  });
  check("unknown product -> 400", ghostProduct.status === 400, "got " + ghostProduct.status);

  section("Settling the order");
  if (order) {
    const short = await api("/api/orders/" + order.id, {
      method: "PATCH",
      body: JSON.stringify({ action: "MARK_PAID", paymentMethod: "CASH", amountReceived: 1 }),
    });
    check("cash tendered below the total -> 400", short.status === 400, "got " + short.status);

    const paid = await api("/api/orders/" + order.id, {
      method: "PATCH",
      body: JSON.stringify({
        action: "MARK_PAID",
        paymentMethod: "CASH",
        amountReceived: expectedTotal + 100,
      }),
    });
    check("MARK_PAID -> 200", paid.status === 200, JSON.stringify(paid.body));
    check("order is now PAID", paid.body?.order?.paymentStatus === "PAID");

    const payment = paid.body?.order?.payments?.at(-1);
    check(
      "change is computed by the server",
      Number(payment?.changeGiven) === 100,
      "got " + payment?.changeGiven
    );

    const doublePay = await api("/api/orders/" + order.id, {
      method: "PATCH",
      body: JSON.stringify({ action: "MARK_PAID", paymentMethod: "CASH" }),
    });
    check("paying twice -> 400", doublePay.status === 400, "got " + doublePay.status);
  }

  section("Purge requires an explicit confirmation");
  const unconfirmed = await api("/api/admin/clear-transactions", {
    method: "POST",
    body: JSON.stringify({}),
  });
  check("purge without the phrase -> 400", unconfirmed.status === 400, "got " + unconfirmed.status);

  section("Custom deals: create, order, edit, withdraw");
  const dealCategory =
    (await api("/api/categories")).body?.find((c) => c.slug === "special-deals") ||
    (await api("/api/categories")).body?.[0];
  check("found a category to hold the deal", !!dealCategory);

  const dealCreate = await api("/api/products", {
    method: "POST",
    body: JSON.stringify({
      name: "Smoke Test Deal",
      description: "1 pizza + 1 drink",
      price: 1499,
      categoryId: dealCategory.id,
      sku: "SMOKE-DEAL-" + Date.now(),
      modifierGroups: [
        {
          name: "Select Pizza Flavour",
          isRequired: true,
          minSelection: 1,
          maxSelection: 1,
          modifiers: [{ name: "Chicken Tikka" }, { name: "Malai Boti" }],
        },
        {
          name: "Extra Topping",
          isRequired: false,
          minSelection: 0,
          maxSelection: 2,
          modifiers: [
            { name: "Extra Cheese", price: 150 },
            { name: "Olives", price: 100 },
          ],
        },
      ],
    }),
  });
  check("deal created -> 201", dealCreate.status === 201, JSON.stringify(dealCreate.body));
  const dealId = dealCreate.body?.id;

  let deal = null;
  if (dealId) {
    createdProductIds.push(dealId);
    const all = await api("/api/products?all=true");
    deal = all.body.find((p) => p.id === dealId);
    check("deal has both option groups", deal?.modifierGroups?.length === 2, String(deal?.modifierGroups?.length));
  }

  if (deal) {
    const flavourGroup = deal.modifierGroups.find((g) => g.name === "Select Pizza Flavour");
    const toppingGroup = deal.modifierGroups.find((g) => g.name === "Extra Topping");
    check("required flag persisted", flavourGroup?.isRequired === true);
    check("optional group is not required", toppingGroup?.isRequired === false);

    // Ordering it without the required choice must be refused.
    const noChoice = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({ orderType: "TAKEAWAY", items: [{ productId: dealId, quantity: 1 }] }),
    });
    check("ordering the deal without picking a flavour -> 400", noChoice.status === 400, "got " + noChoice.status);

    // Picking two flavours when only one is allowed must be refused.
    const twoFlavours = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        orderType: "TAKEAWAY",
        items: [
          {
            productId: dealId,
            quantity: 1,
            modifiers: flavourGroup.modifiers.map((m) => ({ id: m.id })),
          },
        ],
      }),
    });
    check("picking two flavours when max is 1 -> 400", twoFlavours.status === 400, "got " + twoFlavours.status);

    // A correct order prices at the deal price plus the chosen surcharge.
    const cheese = toppingGroup.modifiers.find((m) => m.name === "Extra Cheese");
    const good = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        orderType: "TAKEAWAY",
        items: [
          {
            productId: dealId,
            quantity: 1,
            modifiers: [{ id: flavourGroup.modifiers[0].id }, { id: cheese.id }],
          },
        ],
        grandTotal: 1,
      }),
    });
    check("a correctly configured deal is accepted", good.status === 201, JSON.stringify(good.body));
    if (good.body?.order) {
      createdOrderIds.push(good.body.order.id);
      check(
        "deal price + surcharge is computed server-side (1499 + 150)",
        Number(good.body.order.subtotal) === 1649,
        "got " + good.body.order.subtotal
      );
      check(
        "chosen options are snapshotted onto the line",
        good.body.order.items[0].modifiers.length === 2,
        JSON.stringify(good.body.order.items[0].modifiers?.map((m) => m.modifierName))
      );
    }

    // Editing: rename a group, keep one option, drop one, add one.
    const keptOptionId = flavourGroup.modifiers[0].id;
    const edit = await api("/api/products", {
      method: "PUT",
      body: JSON.stringify({
        id: dealId,
        modifierGroups: [
          {
            id: flavourGroup.id,
            name: "Choose Your Pizza",
            isRequired: true,
            minSelection: 1,
            maxSelection: 1,
            modifiers: [
              { id: keptOptionId, name: "Chicken Tikka", price: 0 },
              { name: "Bihari Kabab", price: 0 },
            ],
          },
        ],
      }),
    });
    check("editing the deal's options -> 200", edit.status === 200, JSON.stringify(edit.body));

    const afterEdit = (await api("/api/products?all=true")).body.find((p) => p.id === dealId);
    check("the optional group was removed", afterEdit?.modifierGroups?.length === 1, String(afterEdit?.modifierGroups?.length));
    const editedGroup = afterEdit?.modifierGroups?.[0];
    check("the group was renamed", editedGroup?.name === "Choose Your Pizza", editedGroup?.name);
    check(
      "the kept option kept its identity rather than being recreated",
      editedGroup?.modifiers?.some((m) => m.id === keptOptionId)
    );
    check(
      "the replaced option is gone and the new one is there",
      editedGroup?.modifiers?.some((m) => m.name === "Bihari Kabab") &&
        !editedGroup?.modifiers?.some((m) => m.name === "Malai Boti")
    );

    // The availability toggle must not wipe the options it never sent.
    const toggle = await api("/api/products", {
      method: "PUT",
      body: JSON.stringify({ id: dealId, isAvailable: false }),
    });
    check("toggling availability -> 200", toggle.status === 200);
    const afterToggle = (await api("/api/products?all=true")).body.find((p) => p.id === dealId);
    check(
      "toggling availability left the option groups intact",
      afterToggle?.modifierGroups?.length === 1,
      String(afterToggle?.modifierGroups?.length)
    );

    // Invalid edits are refused.
    const badEdit = await api("/api/products", {
      method: "PUT",
      body: JSON.stringify({
        id: dealId,
        modifierGroups: [{ name: "Broken", minSelection: 5, maxSelection: 1, modifiers: [{ name: "Only one" }] }],
      }),
    });
    check("a group requiring more than it offers -> 400", badEdit.status === 400, "got " + badEdit.status);
  }

  section("Sign-out");
  const logout = await api("/api/auth/logout", { method: "POST" });
  check("POST /api/auth/logout -> 200", logout.status === 200);
}

async function cleanup() {
  for (const id of createdOrderIds) {
    await prisma.order.delete({ where: { id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { entityId: id } }).catch(() => {});
  }
  for (const id of createdProductIds) {
    // Order lines snapshot their own name and price, so removing the test product
    // cannot disturb anything real.
    await prisma.orderItem.deleteMany({ where: { productId: id } }).catch(() => {});
    await prisma.product.delete({ where: { id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { entityId: id } }).catch(() => {});
  }
  if (createdOrderIds.length || createdProductIds.length) {
    console.log(
      "\nRemoved " +
        createdOrderIds.length +
        " test order(s) and " +
        createdProductIds.length +
        " test product(s)."
    );
  }
}

main()
  .catch((error) => {
    failed += 1;
    console.error("\nSmoke test crashed:", error);
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log("\n" + "=".repeat(40));
    console.log("passed: " + passed + "   failed: " + failed);
    console.log("=".repeat(40));
    process.exitCode = failed === 0 ? 0 : 1;
  });
