import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_USER_ID = "demo-user-001";

export async function GET() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Current month transactions
  const currentMonthTxs = await prisma.transaction.findMany({
    where: {
      account: { userId: DEMO_USER_ID },
      date: { gte: startOfMonth },
    },
    orderBy: { date: "desc" },
  });

  // Last month transactions
  const lastMonthTxs = await prisma.transaction.findMany({
    where: {
      account: { userId: DEMO_USER_ID },
      date: { gte: startOfLastMonth, lt: startOfMonth },
    },
  });

  // Account balance
  const account = await prisma.bankAccount.findFirst({
    where: { userId: DEMO_USER_ID },
  });

  // Spending by category (current month)
  const spendingByCategory = currentMonthTxs.reduce(
    (acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
      return acc;
    },
    {} as Record<string, number>
  );

  const categoryData = Object.entries(spendingByCategory)
    .map(([category, total]) => ({
      category,
      total: Math.round(total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total);

  // Monthly totals (last 3 months)
  const allTxs = await prisma.transaction.findMany({
    where: { account: { userId: DEMO_USER_ID } },
    orderBy: { date: "desc" },
  });

  const monthlyMap = allTxs.reduce(
    (acc, tx) => {
      const key = tx.date.toLocaleDateString("es-MX", {
        month: "short",
        year: "2-digit",
      });
      acc[key] = (acc[key] || 0) + tx.amount;
      return acc;
    },
    {} as Record<string, number>
  );

  const monthlyData = Object.entries(monthlyMap)
    .map(([month, total]) => ({
      month,
      total: Math.round(total * 100) / 100,
    }))
    .reverse();

  const currentTotal = currentMonthTxs.reduce((s, tx) => s + tx.amount, 0);
  const lastTotal = lastMonthTxs.reduce((s, tx) => s + tx.amount, 0);
  const trendPercent =
    lastTotal > 0
      ? Math.round(((currentTotal - lastTotal) / lastTotal) * 100)
      : 0;

  return NextResponse.json({
    balance: account?.currentBalance ?? 0,
    currentMonthSpending: Math.round(currentTotal * 100) / 100,
    lastMonthSpending: Math.round(lastTotal * 100) / 100,
    trendPercent,
    transactionCount: currentMonthTxs.length,
    recentTransactions: currentMonthTxs.slice(0, 10).map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      description: tx.description,
      category: tx.category,
      date: tx.date.toISOString(),
      pending: tx.pending,
    })),
    categoryData,
    monthlyData,
  });
}
