"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { CATEGORIES, getCategoryColor, getCategoryIcon } from "@/lib/categories";

interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  pending: boolean;
}

export default function TransaccionesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "15",
    });
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);

    fetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setTransactions(d.transactions);
        setTotalPages(d.totalPages);
        setLoading(false);
      });
  }, [page, category, search]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Transacciones</h1>
        <p className="text-foreground/50 text-sm mt-1">
          Historial completo de movimientos
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
          <input
            type="text"
            placeholder="Buscar transacciones..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card-bg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2.5 rounded-lg border border-border bg-card-bg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          <option value="all">Todas las categor&iacute;as</option>
          {CATEGORIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Transaction list */}
      <div className="bg-card-bg rounded-xl border border-border shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 p-4 hover:bg-background/50 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
                    style={{
                      backgroundColor: getCategoryColor(tx.category) + "20",
                    }}
                  >
                    {getCategoryIcon(tx.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tx.description}
                      {tx.pending && (
                        <span className="ml-2 text-xs text-warning font-normal">
                          Pendiente
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-foreground/40">
                      {tx.category} &middot;{" "}
                      {new Date(tx.date).toLocaleDateString("es-MX", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-danger">
                    -$
                    {tx.amount.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t border-border">
              <p className="text-sm text-foreground/50">
                P&aacute;gina {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-30 hover:bg-background"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-30 hover:bg-background"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
