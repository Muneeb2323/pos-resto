import { PrismaClient, Role, TableStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🔥 Purging all existing data and seeding official Fork & Fire menu...");

  // 1. Clean old transactions, products, categories
  await prisma.orderItemModifier.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.kitchenOrder.deleteMany();
  await prisma.order.deleteMany();
  await prisma.modifier.deleteMany();
  await prisma.modifierGroup.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.registerSession.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.auditLog.deleteMany();

  console.log("✓ Existing catalog and transactions purged cleanly.");

  // 2. Official Restaurant Settings from Menu Card
  await prisma.restaurantSettings.upsert({
    where: { id: "singleton" },
    update: {
      restaurantName: "FORK & FIRE",
      tagline: "Special Fast Food & Pizza Menu — Taste The Heat",
      address: "Main Karkhana Bazar, Chak No 267 RB, Jallandhar Arain",
      phone: "0301-9622267, 0305-7729767",
      currency: "PKR",
      currencySymbol: "Rs. ",
      taxRate: 0.0, // fast-food gross inclusive or 0% by default, configurable
      receiptHeader: "FORK & FIRE\nSpecial Fast Food, Pizza & Deals Menu\nMain Karkhana Bazar, Chak 267 RB, Jallandhar Arain\nDelivery / WhatsApp: 0301-9622267 / 0305-7729767",
      receiptFooter: "GOOD FOOD • GOOD LIFE\nFresh & Hot Delivery to Your Doorstep!\nTaste The Heat",
      orderNumberPrefix: "#",
      warningKitchenTime: 10,
      criticalKitchenTime: 20,
      printerType: "thermal_80mm",
      paperWidth: 80,
      autoPrintReceipt: true,
    },
    create: {
      id: "singleton",
      restaurantName: "FORK & FIRE",
      tagline: "Special Fast Food & Pizza Menu — Taste The Heat",
      address: "Main Karkhana Bazar, Chak No 267 RB, Jallandhar Arain",
      phone: "0301-9622267, 0305-7729767",
      currency: "PKR",
      currencySymbol: "Rs. ",
      taxRate: 0.0,
      receiptHeader: "FORK & FIRE\nSpecial Fast Food, Pizza & Deals Menu\nMain Karkhana Bazar, Chak 267 RB, Jallandhar Arain\nDelivery / WhatsApp: 0301-9622267 / 0305-7729767",
      receiptFooter: "GOOD FOOD • GOOD LIFE\nFresh & Hot Delivery to Your Doorstep!\nTaste The Heat",
      orderNumberPrefix: "#",
      warningKitchenTime: 10,
      criticalKitchenTime: 20,
      printerType: "thermal_80mm",
      paperWidth: 80,
      autoPrintReceipt: true,
    },
  });
  console.log("✓ Updated Restaurant Settings with official address & phones");

  // 3. Admin User from .env
  const adminUsername = (process.env.ADMIN_USERNAME || "admin").toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      "ADMIN_PASSWORD is not set in .env. Set a real password before seeding - the seed " +
        "will not fall back to a well-known default."
    );
  }
  const adminName = process.env.ADMIN_NAME || "Farhan Ali (Admin)";
  const salt = await bcrypt.genSalt(10);
  const adminHash = await bcrypt.hash(adminPassword, salt);

  await prisma.user.upsert({
    where: { username: adminUsername },
    update: { isActive: true, passwordHash: adminHash, name: adminName },
    create: {
      username: adminUsername,
      passwordHash: adminHash,
      name: adminName,
      role: Role.ADMIN,
      isActive: true,
    },
  });
  console.log(`✓ Admin User configured from .env (${adminUsername})`);

  // 4. Tables 1 through 10
  for (let i = 1; i <= 10; i++) {
    await prisma.restaurantTable.upsert({
      where: { name: `Table ${i}` },
      update: { status: TableStatus.AVAILABLE, currentOrderId: null },
      create: {
        name: `Table ${i}`,
        capacity: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2,
        status: TableStatus.AVAILABLE,
      },
    });
  }
  console.log("✓ Tables 1-10 initialized to AVAILABLE");

  // 5. Official Categories from Menu Card
  const categoriesData = [
    { name: "Special Deals", slug: "special-deals", sortOrder: 0, icon: "sparkles" },
    { name: "Delicious Pizzas", slug: "pizzas", sortOrder: 1, icon: "pizza" },
    { name: "Shawarma & Rolls", slug: "shawarma", sortOrder: 2, icon: "wrap" },
    { name: "Burgers & Mains", slug: "burgers", sortOrder: 3, icon: "burger" },
    { name: "Pasta, Sides & Starters", slug: "starters", sortOrder: 4, icon: "utensils" },
    { name: "Crispy Fries", slug: "fries", sortOrder: 5, icon: "french-fries" },
    { name: "Cold Drinks & Beverages", slug: "drinks", sortOrder: 6, icon: "cup-soda" },
  ];

  const catMap: Record<string, string> = {};
  for (const c of categoriesData) {
    const created = await prisma.category.create({
      data: c,
    });
    catMap[c.slug] = created.id;
  }
  console.log("✓ Created 7 Official Menu Categories (including Special Deals)");

  // 5.5 SPECIAL DEALS (10 Deals from Special Deal Menu)
  const pizzaFlavorsList = [
    "Fork & Fire Special [HOT]",
    "Born Fire",
    "Chicken Supreme",
    "Chicken Fajita",
    "Chicken Tikka",
    "Bihari Kabab",
    "Malai Boti",
    "Macaroni Pizza",
  ];

  const dealsList = [
    {
      sku: "DEAL-01",
      name: "Deal 1",
      price: 1499,
      description: "1 Large Pizza + 1 Litre Drink",
      barcode: "8964901",
      sortOrder: 1,
      modifierGroups: [
        {
          name: "Select Large Pizza Flavor",
          minSelection: 1,
          maxSelection: 1,
          isRequired: true,
          modifiers: pizzaFlavorsList.map((f) => ({ name: f, price: 0 })),
        },
        {
          name: "Select 1 Litre Drink",
          minSelection: 1,
          maxSelection: 1,
          isRequired: true,
          modifiers: [
            { name: "Next Cola 1 Litre", price: 0 },
            { name: "Sprite / 7Up 1 Litre", price: 0 },
            { name: "Gourmet / Regular 1 Litre", price: 0 },
          ],
        },
        {
          name: "Extra Topping",
          minSelection: 0,
          maxSelection: 1,
          isRequired: false,
          modifiers: [{ name: "Extra Cheese", price: 100 }],
        },
      ],
    },
    {
      sku: "DEAL-02",
      name: "Deal 2 (Student Deal)",
      price: 699,
      description: "1 Patty Burger + 1 Zinger Burger + 300ml Next Cola",
      barcode: "8964902",
      sortOrder: 2,
      modifierGroups: [
        {
          name: "Drink Option",
          minSelection: 0,
          maxSelection: 1,
          isRequired: false,
          modifiers: [
            { name: "300ml Next Cola", price: 0 },
            { name: "300ml Sprite / 7Up", price: 0 },
          ],
        },
      ],
    },
    {
      sku: "DEAL-03",
      name: "Deal 3",
      price: 1000,
      description: "2 Small Pizzas + 1 Litre Drink",
      barcode: "8964903",
      sortOrder: 3,
      modifierGroups: [
        {
          name: "First Small Pizza Flavor",
          minSelection: 1,
          maxSelection: 1,
          isRequired: true,
          modifiers: pizzaFlavorsList.map((f) => ({ name: `1st: ${f}`, price: 0 })),
        },
        {
          name: "Second Small Pizza Flavor",
          minSelection: 1,
          maxSelection: 1,
          isRequired: true,
          modifiers: pizzaFlavorsList.map((f) => ({ name: `2nd: ${f}`, price: 0 })),
        },
        {
          name: "Select 1 Litre Drink",
          minSelection: 1,
          maxSelection: 1,
          isRequired: true,
          modifiers: [
            { name: "Next Cola 1 Litre", price: 0 },
            { name: "Sprite / 7Up 1 Litre", price: 0 },
          ],
        },
        {
          name: "Extra Topping",
          minSelection: 0,
          maxSelection: 2,
          isRequired: false,
          modifiers: [
            { name: "Extra Cheese (Pizza 1)", price: 100 },
            { name: "Extra Cheese (Pizza 2)", price: 100 },
          ],
        },
      ],
    },
    {
      sku: "DEAL-04",
      name: "Deal 4",
      price: 500,
      description: "1 Zinger Shawarma + 1 Chicken Shawarma + 300ml Next Cola",
      barcode: "8964904",
      sortOrder: 4,
    },
    {
      sku: "DEAL-05",
      name: "Deal 5",
      price: 550,
      description: "1 Chicken Sandwich + Fries + 5 Pcs Nuggets + 300ml Next Cola",
      barcode: "8964905",
      sortOrder: 5,
    },
    {
      sku: "DEAL-06",
      name: "Deal 6",
      price: 500,
      description: "1 Chicken Corn Dog + 1 Patty Burger + 300ml Next Cola",
      barcode: "8964906",
      sortOrder: 6,
    },
    {
      sku: "DEAL-07",
      name: "Deal 7",
      price: 750,
      description: "1 Loaded Fries (Reg) + 1 Masala Burger + Fries + 300ml Next Cola",
      barcode: "8964907",
      sortOrder: 7,
    },
    {
      sku: "DEAL-08",
      name: "Deal 8",
      price: 999,
      description: "1 Chicken Sandwich + 1 Crunchy Pasta + 1 Zinger Burger + Fries + 300ml Next Cola",
      barcode: "8964908",
      sortOrder: 8,
    },
    {
      sku: "DEAL-09",
      name: "Deal 9",
      price: 650,
      description: "6 Pcs Peri Peri Wings + 6 Pcs Nuggets + Fries + Potato Ring + 300ml Drink",
      barcode: "8964909",
      sortOrder: 9,
    },
    {
      sku: "DEAL-10",
      name: "Deal 10",
      price: 499,
      description: "1 Chicken Popcorn + 1 Masala Fries + 300ml Drink",
      barcode: "8964910",
      sortOrder: 10,
    },
  ];

  for (const d of dealsList) {
    const createdProd = await prisma.product.create({
      data: {
        name: d.name,
        price: d.price,
        description: d.description,
        categoryId: catMap["special-deals"],
        sku: d.sku,
        barcode: d.barcode,
        sortOrder: d.sortOrder,
        isActive: true,
        isAvailable: true,
      },
    });

    if (d.modifierGroups && d.modifierGroups.length > 0) {
      for (const grp of d.modifierGroups) {
        await prisma.modifierGroup.create({
          data: {
            name: grp.name,
            minSelection: grp.minSelection,
            maxSelection: grp.maxSelection,
            isRequired: grp.isRequired,
            productId: createdProd.id,
            modifiers: {
              create: grp.modifiers,
            },
          },
        });
      }
    }
  }
  console.log("✓ Created 10 Special Deals");

  // 6. DELICIOUS PIZZAS
  // S / M / L / XL Flavors
  const standardPizzas = [
    { name: "Fork & Fire Special [HOT]", s: 499, m: 999, l: 1400, xl: 1650, sku: "PIZ-FFS" },
    { name: "Born Fire", s: 499, m: 999, l: 1400, xl: 1650, sku: "PIZ-BNF" },
    { name: "Chicken Supreme", s: 450, m: 950, l: 1350, xl: 1550, sku: "PIZ-SUP" },
    { name: "Chicken Fajita", s: 450, m: 950, l: 1350, xl: 1550, sku: "PIZ-FAJ" },
    { name: "Chicken Tikka", s: 450, m: 950, l: 1350, xl: 1550, sku: "PIZ-TIK" },
    { name: "Bihari Kabab", s: 550, m: 1200, l: 1500, xl: 1750, sku: "PIZ-BIH" },
    { name: "Malai Boti", s: 550, m: 1200, l: 1500, xl: 1750, sku: "PIZ-MAL" },
    { name: "Macaroni Pizza", s: 550, m: 1200, l: 1500, xl: 1750, sku: "PIZ-MAC" },
  ];

  for (let idx = 0; idx < standardPizzas.length; idx++) {
    const p = standardPizzas[idx];
    const prod = await prisma.product.create({
      data: {
        name: p.name,
        description: `Small Rs. ${p.s} | Medium Rs. ${p.m} | Large Rs. ${p.l} | XL Rs. ${p.xl}`,
        price: p.s, // Base price Small
        categoryId: catMap["pizzas"],
        sku: p.sku,
        barcode: `896410${idx + 10}`,
        sortOrder: idx + 1,
        isActive: true,
        isAvailable: true,
      },
    });

    // Size Selection Modifier Group (Required)
    await prisma.modifierGroup.create({
      data: {
        name: "Select Pizza Size",
        minSelection: 1,
        maxSelection: 1,
        isRequired: true,
        productId: prod.id,
        modifiers: {
          create: [
            { name: "Small (S)", price: 0 },
            { name: "Medium (M)", price: p.m - p.s },
            { name: "Large (L)", price: p.l - p.s },
            { name: "Extra Large (XL)", price: p.xl - p.s },
          ],
        },
      },
    });

    // Extra Toppings
    await prisma.modifierGroup.create({
      data: {
        name: "Extra Toppings",
        minSelection: 0,
        maxSelection: 2,
        isRequired: false,
        productId: prod.id,
        modifiers: {
          create: [
            { name: "Extra Cheese", price: 100 },
          ],
        },
      },
    });
  }

  // Pizzas starting at Medium (M / L / XL only)
  const premiumPizzas = [
    { name: "Chicken Cheese Stufffer", m: 1300, l: 1700, xl: 1900, sku: "PIZ-STF" },
    { name: "Pepperoni (Extra Cheese)", m: 1300, l: 1700, xl: 1900, sku: "PIZ-PEP" },
    { name: "Creamy Mushroom Chicken", m: 1200, l: 1500, xl: 1700, sku: "PIZ-MSH" },
  ];

  for (let idx = 0; idx < premiumPizzas.length; idx++) {
    const p = premiumPizzas[idx];
    const prod = await prisma.product.create({
      data: {
        name: p.name,
        description: `Medium Rs. ${p.m} | Large Rs. ${p.l} | XL Rs. ${p.xl}`,
        price: p.m, // Base price Medium
        categoryId: catMap["pizzas"],
        sku: p.sku,
        barcode: `896410${idx + 30}`,
        sortOrder: idx + 10,
        isActive: true,
        isAvailable: true,
      },
    });

    await prisma.modifierGroup.create({
      data: {
        name: "Select Pizza Size",
        minSelection: 1,
        maxSelection: 1,
        isRequired: true,
        productId: prod.id,
        modifiers: {
          create: [
            { name: "Medium (M)", price: 0 },
            { name: "Large (L)", price: p.l - p.m },
            { name: "Extra Large (XL)", price: p.xl - p.m },
          ],
        },
      },
    });

    await prisma.modifierGroup.create({
      data: {
        name: "Extra Toppings",
        minSelection: 0,
        maxSelection: 2,
        isRequired: false,
        productId: prod.id,
        modifiers: {
          create: [
            { name: "Extra Cheese", price: 100 },
          ],
        },
      },
    });
  }
  console.log("✓ Created 11 Pizza Flavors with Size Modifiers & Extra Cheese");

  // 7. SHAWARMA & ROLLS
  const shawarmaRolls = [
    { name: "Pizza Shawarma", price: 350, sku: "SHW-PIZ" },
    { name: "Zinger Paratha", price: 350, sku: "SHW-ZNG-PAR" },
    { name: "Pizza Paratha Roll", price: 330, sku: "SHW-PIZ-ROL" },
    { name: "Zinger Shawarma", price: 320, sku: "SHW-ZNG" },
    { name: "Chicken Paratha", price: 200, sku: "SHW-CHK-PAR" },
    { name: "Chicken Shawarma", price: 200, sku: "SHW-CHK" },
  ];

  for (let idx = 0; idx < shawarmaRolls.length; idx++) {
    const s = shawarmaRolls[idx];
    const prod = await prisma.product.create({
      data: {
        name: s.name,
        price: s.price,
        categoryId: catMap["shawarma"],
        sku: s.sku,
        barcode: `896420${idx + 10}`,
        sortOrder: idx + 1,
        isActive: true,
        isAvailable: true,
      },
    });

    // Cooking options
    await prisma.modifierGroup.create({
      data: {
        name: "Custom Options",
        minSelection: 0,
        maxSelection: 3,
        isRequired: false,
        productId: prod.id,
        modifiers: {
          create: [
            { name: "Extra Sauce", price: 30 },
            { name: "Extra Cheese", price: 80 },
            { name: "No Salad", price: 0 },
            { name: "Extra Spicy", price: 0 },
          ],
        },
      },
    });
  }
  console.log("✓ Created 6 Shawarma & Rolls items");

  // 8. BURGERS & MAINS
  const burgersMains = [
    { name: "Smash Burger [SPECIAL]", price: 700, sku: "BRG-SMSH" },
    { name: "Masala Burger + Fries", price: 380, sku: "BRG-MAS-FRY" },
    { name: "Zinger Burger + Fries", price: 350, sku: "BRG-ZNG-FRY" },
    { name: "Patty Burger", price: 280, sku: "BRG-PATTY" },
    { name: "Chicken Sando", price: 250, sku: "BRG-SANDO" },
    { name: "Chicken Sandwich", price: 450, sku: "SND-CHICKEN" },
    { name: "Bar B Q Sandwich", price: 250, sku: "SND-BBQ" },
    { name: "Club Sandwich + Fries", price: 240, sku: "SND-CLUB-FRY" },
    { name: "Chicken Nugget + Fries", price: 450, sku: "NGT-CHICKEN-FRY" },
  ];

  for (let idx = 0; idx < burgersMains.length; idx++) {
    const b = burgersMains[idx];
    const prod = await prisma.product.create({
      data: {
        name: b.name,
        price: b.price,
        categoryId: catMap["burgers"],
        sku: b.sku,
        barcode: `896430${idx + 10}`,
        sortOrder: idx + 1,
        isActive: true,
        isAvailable: true,
      },
    });

    // Burger extras
    await prisma.modifierGroup.create({
      data: {
        name: "Extras & Options",
        minSelection: 0,
        maxSelection: 4,
        isRequired: false,
        productId: prod.id,
        modifiers: {
          create: [
            { name: "Extra Cheese Slice", price: 80 },
            { name: "Extra Sauce", price: 30 },
            { name: "Pickled Jalapeños", price: 40 },
            { name: "No Onion", price: 0 },
            { name: "No Pickles", price: 0 },
          ],
        },
      },
    });
  }
  console.log("✓ Created 9 Burgers & Mains items");

  // 9. PASTA, SIDES & STARTERS
  const starters = [
    {
      name: "Macaroni Pasta",
      price: 350,
      description: "Small Rs. 350 | Large Rs. 680",
      sku: "PAS-MAC",
      hasSize: true,
      small: 350,
      large: 680,
    },
    { name: "White Sauce Pasta", price: 450, sku: "PAS-WHT" },
    { name: "Crunchy Pasta / Creamy Pasta", price: 350, sku: "PAS-CRN" },
    { name: "Mexican Hot Wings (Honey)", price: 400, sku: "STR-MEX-WNG" },
    { name: "Peri Peri Wings", price: 350, sku: "STR-PERI-WNG" },
    { name: "Thai Fried Chicken", price: 350, sku: "STR-THAI-CHK" },
    { name: "Chicken Popcorn", price: 300, sku: "STR-POPCORN" },
    { name: "Chicken Corn Dogs", price: 180, sku: "STR-CORNDOG" },
    { name: "Potato Rings", price: 150, sku: "STR-PTRING" },
    { name: "Dip Sauce", price: 50, sku: "STR-DIP" },
    { name: "Chicken Manchurian + Egg Fried Rice", price: 650, sku: "MAN-RICE" },
  ];

  for (let idx = 0; idx < starters.length; idx++) {
    const item = starters[idx];
    const prod = await prisma.product.create({
      data: {
        name: item.name,
        description: item.description || null,
        price: item.price,
        categoryId: catMap["starters"],
        sku: item.sku,
        barcode: `896440${idx + 10}`,
        sortOrder: idx + 1,
        isActive: true,
        isAvailable: true,
      },
    });

    if (item.hasSize) {
      await prisma.modifierGroup.create({
        data: {
          name: "Select Portion Size",
          minSelection: 1,
          maxSelection: 1,
          isRequired: true,
          productId: prod.id,
          modifiers: {
            create: [
              { name: "Small (S)", price: 0 },
              { name: "Large (L)", price: item.large - item.small },
            ],
          },
        },
      });
    }
  }
  console.log("✓ Created 11 Pasta, Sides & Starters items");

  // 10. CRISPY FRIES (Small/Reg & Large)
  const friesData = [
    { name: "Plain Fries", small: 180, large: 350, sku: "FRY-PLN" },
    { name: "Masala Fries", small: 180, large: 350, sku: "FRY-MAS" },
    { name: "Loaded Fries", small: 350, large: 650, sku: "FRY-LOAD" },
    { name: "Garlic Mayo Fries", small: 230, large: 430, sku: "FRY-GARLIC" },
  ];

  for (let idx = 0; idx < friesData.length; idx++) {
    const f = friesData[idx];
    const prod = await prisma.product.create({
      data: {
        name: f.name,
        description: `Small/Reg Rs. ${f.small} | Large Rs. ${f.large}`,
        price: f.small,
        categoryId: catMap["fries"],
        sku: f.sku,
        barcode: `896450${idx + 10}`,
        sortOrder: idx + 1,
        isActive: true,
        isAvailable: true,
      },
    });

    await prisma.modifierGroup.create({
      data: {
        name: "Select Fries Size",
        minSelection: 1,
        maxSelection: 1,
        isRequired: true,
        productId: prod.id,
        modifiers: {
          create: [
            { name: "Small / Regular", price: 0 },
            { name: "Large Portion", price: f.large - f.small },
          ],
        },
      },
    });
  }
  console.log("✓ Created 4 Crispy Fries items with Small/Reg & Large sizes");

  // 11. COLD DRINKS & BEVERAGES
  const drinksData = [
    { name: "Rob Roy", price: 320, sku: "DRK-ROB-ROY" },
    { name: "Fork & Fire Drink", price: 300, sku: "DRK-FF-SPECIAL" },
    { name: "Pink Lady Cocktail / Pina Colada", price: 300, sku: "DRK-PINK-PINA" },
    { name: "Cold Coffee", price: 280, sku: "DRK-COLD-COFFEE" },
    { name: "Milk Pot", price: 250, sku: "DRK-MILK-POT" },
    { name: "Mint Margarita", price: 150, sku: "DRK-MINT-MARG" },
    { name: "CHAI", price: 80, sku: "HOT-CHAI" },
  ];

  for (let idx = 0; idx < drinksData.length; idx++) {
    const d = drinksData[idx];
    await prisma.product.create({
      data: {
        name: d.name,
        price: d.price,
        categoryId: catMap["drinks"],
        sku: d.sku,
        barcode: `896460${idx + 10}`,
        sortOrder: idx + 1,
        isActive: true,
        isAvailable: true,
      },
    });
  }
  console.log("✓ Created 7 Cold Drinks & Beverages items");

  // 12. Sample Delivery Customers
  await prisma.customer.create({
    data: {
      name: "Chaudhry Nadeem",
      phone: "03019622267",
      address: "Near Khanna Bazar, Chak 267 RB",
      notes: "VIP Delivery Customer",
      orderCount: 0,
      totalSpent: 0,
    },
  });

  await prisma.customer.create({
    data: {
      name: "Mian Arshad",
      phone: "03057729767",
      address: "Main Khar, Jallandhar Arain",
      notes: "Frequent caller",
      orderCount: 0,
      totalSpent: 0,
    },
  });

  console.log("==================================================");
  console.log("🔥 FORK & FIRE OFFICIAL MENU IMPORT COMPLETED!");
  console.log("==================================================");
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
