"use client";

import { useEffect, useState } from "react";
import { getCategoryColor, getCategoryIcon } from "@/lib/categories";

interface Budget {
  id: string;
  category: string;
  limit: number;
  spent: number;
  percentage: number;
}

export default function PresupuestosPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/budgets")
      .then((r) => r.json())
      .then((d) => {
        setBudgets(d.budgets);
        setLoading(false);
      });
  }, []);

  const fmt = (n: number) =>
    "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  const totalBudget = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Presupuestos</h1>
        <p className="text-foreground/50 text-sm mt-1">
          Controla tus gastos por categor&iacute;a
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-card-bg rounded-xl p-6 border border-border shadow-sm mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-foreground/50">Total gastado</p>
            <p className="text-3xl font-bold">{fmt(totalSpent)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-foreground/50">Presupuesto total</p>
            <p className="text-3xl font-bold text-foreground/30">
              {fmt(totalBudget)}
            </p>
          </div>
        </div>
        <div className="w-full bg-border rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              totalSpent / totalBudget > 0.9
                ? "bg-danger"
                : totalSpent / totalBudget > 0.7
                  ? "bg-warning"
                  : "bg-success"
            }`}
            style={{
              width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%`,
            }}
          />
        </div>
        <p className="text-xs text-foreground/40 mt-2">
          {Math.round((totalSpent / totalBudget) * 100)}% utilizado
        </p>
      </div>

      {/* Budget cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {budgets.map((budget) => {
          const color = getCategoryColor(budget.category);
          const icon = getCategoryIcon(budget.category);
          const isOver = budget.spent > budget.limit;
          const isWarning = budget.percentage > 70;

          return (
            <div
              key={budget.id}
              className="bg-card-bg rounded-xl p-6 border border-border shadow-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: color + "20" }}
                >
                  {icon}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{budget.category}</p>
                  <p className="text-xs text-foreground/40">
                    {fmt(budget.spent)} de {fmt(budget.limit)}
                  </p>
                </div>
                {isOver && (
                  <span className="text-xs font-medium text-danger bg-danger/10 px-2 py-1 rounded-full">
                    Excedido
                  </span>
                )}
                {!isOver && isWarning && (
                  <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-1 rounded-full">
                    Cuidado
                  </span>
                )}
              </div>
              <div className="w-full bg-border rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min(budget.percentage, 100)}%`,
                    backgroundColor: isOver
                      ? "#ef4444"
                      : isWarning
                        ? "#f59e0b"
                        : color,
                  }}
                />
              </div>
              <p className="text-xs text-foreground/40 mt-2 text-right">
                {budget.percentage}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
