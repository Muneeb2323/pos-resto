const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Adding Special Deals to FORK & FIRE database...");

  // 1. Update Restaurant Settings address to match the deal menu card precisely
  await prisma.restaurantSettings.update({
    where: { id: "singleton" },
    data: {
      address: "Main Karkhana Bazar, Chak No 267 RB, Jallandhar Arain",
      receiptHeader: "FORK & FIRE\nSpecial Fast Food, Pizza & Deals Menu\nMain Karkhana Bazar, Chak 267 RB, Jallandhar Arain\nDelivery: 0301-9622267 / 0305-7729767",
      receiptFooter: "GOOD FOOD • GOOD LIFE\nFresh & Hot Delivery to Your Doorstep!\nTaste The Heat",
    },
  });
  console.log("✓ Updated restaurant address & receipt details");

  // 2. Ensure "Special Deals" Category exists
  let dealCat = await prisma.category.findUnique({
    where: { slug: "special-deals" },
  });

  if (!dealCat) {
    // Shift other category sort orders if needed, or place deals at sortOrder: 0
    dealCat = await prisma.category.create({
      data: {
        name: "Special Deals",
        slug: "special-deals",
        sortOrder: 0, // Appears at the very top of categories
        isActive: true,
        icon: "sparkles",
      },
    });
    console.log("✓ Created 'Special Deals' Category (sortOrder: 0)");
  } else {
    console.log("✓ 'Special Deals' Category already exists");
  }

  // 3. Define 10 Deals from the menu card
  const pizzaFlavors = [
    "Fork & Fire Special [HOT]",
    "Born Fire",
    "Chicken Supreme",
    "Chicken Fajita",
    "Chicken Tikka",
    "Bihari Kabab",
    "Malai Boti",
    "Macaroni Pizza",
  ];

  const deals = [
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
          modifiers: pizzaFlavors.map((f) => ({ name: f, price: 0 })),
        },
        {
          name: "Select 1 Litre Drink",
          minSelection: 1,
          maxSelection: 1,
          isRequired: true,
          modifiers: [
            { name: "Next Cola 1 Litre", price: 0 },
            { name: "Gourmet / Regular 1 Litre", price: 0 },
            { name: "Sprite / 7Up 1 Litre", price: 0 },
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
          modifiers: pizzaFlavors.map((f) => ({ name: `1st: ${f}`, price: 0 })),
        },
        {
          name: "Second Small Pizza Flavor",
          minSelection: 1,
          maxSelection: 1,
          isRequired: true,
          modifiers: pizzaFlavors.map((f) => ({ name: `2nd: ${f}`, price: 0 })),
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

  for (const deal of deals) {
    // Delete existing if re-running
    const existing = await prisma.product.findUnique({
      where: { sku: deal.sku },
    });
    if (existing) {
      await prisma.product.delete({ where: { id: existing.id } });
    }

    const createdProd = await prisma.product.create({
      data: {
        name: deal.name,
        price: deal.price,
        description: deal.description,
        categoryId: dealCat.id,
        sku: deal.sku,
        barcode: deal.barcode,
        sortOrder: deal.sortOrder,
        isActive: true,
        isAvailable: true,
      },
    });

    if (deal.modifierGroups && deal.modifierGroups.length > 0) {
      for (const group of deal.modifierGroups) {
        await prisma.modifierGroup.create({
          data: {
            name: group.name,
            minSelection: group.minSelection,
            maxSelection: group.maxSelection,
            isRequired: group.isRequired,
            productId: createdProd.id,
            modifiers: {
              create: group.modifiers,
            },
          },
        });
      }
    }
    console.log(`✓ Added ${deal.name} (Rs. ${deal.price})`);
  }

  console.log("==================================================");
  console.log("All 10 Special Deals successfully added to FORK & FIRE!");
  console.log("==================================================");
}

main()
  .catch((e) => {
    console.error("Error adding deals:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
