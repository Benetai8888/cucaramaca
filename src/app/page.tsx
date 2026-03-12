"use client";

import { useEffect, useState } from "react";
import { Wallet, TrendingDown, Receipt, CreditCard } from "lucide-react";
import StatCard from "@/components/StatCard";
import TransactionList from "@/components/TransactionList";
import SpendingChart from "@/components/SpendingChart";
import MonthlyChart from "@/components/MonthlyChart";

interface DashboardData {
  balance: number;
  currentMonthSpending: number;
  lastMonthSpending: number;
  trendPercent: number;
  transactionCount: number;
  recentTransactions: Array<{
    id: string;
    amount: number;
    description: string;
    category: string;
    date: string;
    pending: boolean;
  }>;
  categoryData: Array<{ category: string; total: number }>;
  monthlyData: Array<{ month: string; total: number }>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  const fmt = (n: number) =>
    "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2 });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-foreground/50 text-sm mt-1">
          Resumen de tus finanzas personales
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Balance"
          value={fmt(data.balance)}
          subtitle="Visa *4242"
          icon={CreditCard}
          color="text-accent"
        />
        <StatCard
          title="Gastos del mes"
          value={fmt(data.currentMonthSpending)}
          icon={TrendingDown}
          trend={{
            value: data.trendPercent,
            label: "vs mes anterior",
          }}
          color="text-danger"
        />
        <StatCard
          title="Mes anterior"
          value={fmt(data.lastMonthSpending)}
          icon={Wallet}
          color="text-success"
        />
        <StatCard
          title="Transacciones"
          value={data.transactionCount.toString()}
          subtitle="Este mes"
          icon={Receipt}
          color="text-warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SpendingChart data={data.categoryData} />
        <MonthlyChart data={data.monthlyData} />
      </div>

      <TransactionList transactions={data.recentTransactions} />
    </div>
  );
}
