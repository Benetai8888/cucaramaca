import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_USER_ID = "demo-user-001";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = {
    account: { userId: DEMO_USER_ID },
  };

  if (category && category !== "all") {
    where.category = category;
  }

  if (search) {
    where.description = { contains: search };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({
    transactions: transactions.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      description: tx.description,
      category: tx.category,
      date: tx.date.toISOString(),
      pending: tx.pending,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
