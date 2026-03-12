import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_USER_ID = "demo-user-001";

export async function GET() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const budgets = await prisma.budget.findMany({
    where: { userId: DEMO_USER_ID },
  });

  const transactions = await prisma.transaction.findMany({
    where: {
      account: { userId: DEMO_USER_ID },
      date: { gte: startOfMonth },
    },
  });

  const spentByCategory = transactions.reduce(
    (acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
      return acc;
    },
    {} as Record<string, number>
  );

  const budgetData = budgets.map((b) => ({
    id: b.id,
    category: b.category,
    limit: b.amount,
    spent: Math.round((spentByCategory[b.category] || 0) * 100) / 100,
    percentage: Math.min(
      Math.round(
        ((spentByCategory[b.category] || 0) / b.amount) * 100
      ),
      100
    ),
  }));

  return NextResponse.json({ budgets: budgetData });
}
