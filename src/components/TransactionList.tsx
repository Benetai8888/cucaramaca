import { getCategoryColor, getCategoryIcon } from "@/lib/categories";

interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  pending: boolean;
}

interface TransactionListProps {
  transactions: Transaction[];
  showAll?: boolean;
}

export default function TransactionList({
  transactions,
  showAll = false,
}: TransactionListProps) {
  const items = showAll ? transactions : transactions.slice(0, 8);

  return (
    <div className="bg-card-bg rounded-xl border border-border shadow-sm">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Transacciones recientes</h3>
        {!showAll && (
          <a
            href="/transacciones"
            className="text-sm text-accent hover:underline"
          >
            Ver todas
          </a>
        )}
      </div>
      <div className="divide-y divide-border">
        {items.map((tx) => (
          <div key={tx.id} className="flex items-center gap-4 p-4 hover:bg-background/50 transition-colors">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ backgroundColor: getCategoryColor(tx.category) + "20" }}
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
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
            <p className="text-sm font-semibold text-danger">
              -${tx.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
