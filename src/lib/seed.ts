import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_USER_ID = "demo-user-001";

async function main() {
  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: "demo@cucaramaca.app" },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: "demo@cucaramaca.app",
      name: "Usuario Demo",
    },
  });

  // Create demo bank account (simulating Visa)
  const account = await prisma.bankAccount.upsert({
    where: { id: "demo-account-001" },
    update: {},
    create: {
      id: "demo-account-001",
      userId: user.id,
      name: "Visa *4242",
      type: "credit",
      subtype: "credit card",
      currentBalance: 15420.5,
      currency: "MXN",
    },
  });

  // Generate demo transactions for the last 3 months
  const categories = [
    { name: "Comida", merchants: ["Uber Eats", "Rappi", "Oxxo", "Walmart", "Starbucks", "McDonald's"] },
    { name: "Transporte", merchants: ["Uber", "Didi", "Gasolinera Shell", "Caseta Autopista"] },
    { name: "Entretenimiento", merchants: ["Netflix", "Spotify", "Cinépolis", "Steam"] },
    { name: "Compras", merchants: ["Amazon", "Mercado Libre", "Liverpool", "Zara"] },
    { name: "Salud", merchants: ["Farmacia Guadalajara", "Doctoralia", "GNP Seguros"] },
    { name: "Hogar", merchants: ["CFE Luz", "Telmex", "Home Depot", "Gas Natural"] },
    { name: "Servicios", merchants: ["iCloud", "Google One", "Telcel"] },
    { name: "Suscripciones", merchants: ["Netflix", "Spotify Premium", "HBO Max", "ChatGPT Plus"] },
  ];

  const now = new Date();
  const transactions = [];

  for (let daysAgo = 0; daysAgo < 90; daysAgo++) {
    const txCount = Math.floor(Math.random() * 4) + 1;
    for (let i = 0; i < txCount; i++) {
      const cat = categories[Math.floor(Math.random() * categories.length)];
      const merchant = cat.merchants[Math.floor(Math.random() * cat.merchants.length)];
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      date.setHours(Math.floor(Math.random() * 14) + 8);

      let amount: number;
      switch (cat.name) {
        case "Comida": amount = Math.round((Math.random() * 400 + 50) * 100) / 100; break;
        case "Transporte": amount = Math.round((Math.random() * 300 + 30) * 100) / 100; break;
        case "Entretenimiento": amount = Math.round((Math.random() * 500 + 100) * 100) / 100; break;
        case "Compras": amount = Math.round((Math.random() * 2000 + 200) * 100) / 100; break;
        case "Salud": amount = Math.round((Math.random() * 1000 + 100) * 100) / 100; break;
        case "Hogar": amount = Math.round((Math.random() * 800 + 200) * 100) / 100; break;
        default: amount = Math.round((Math.random() * 300 + 50) * 100) / 100;
      }

      transactions.push({
        accountId: account.id,
        amount,
        description: merchant,
        category: cat.name,
        date,
        pending: daysAgo === 0 && Math.random() > 0.5,
      });
    }
  }

  // Clear existing transactions and insert new ones
  await prisma.transaction.deleteMany({ where: { accountId: account.id } });
  await prisma.transaction.createMany({ data: transactions });

  // Create demo budgets
  const budgets = [
    { category: "Comida", amount: 5000 },
    { category: "Transporte", amount: 2000 },
    { category: "Entretenimiento", amount: 1500 },
    { category: "Compras", amount: 3000 },
    { category: "Suscripciones", amount: 800 },
  ];

  for (const b of budgets) {
    await prisma.budget.upsert({
      where: { userId_category_period: { userId: user.id, category: b.category, period: "monthly" } },
      update: { amount: b.amount },
      create: { userId: user.id, category: b.category, amount: b.amount, period: "monthly" },
    });
  }

  console.log(`Seeded: ${transactions.length} transactions, ${budgets.length} budgets`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
