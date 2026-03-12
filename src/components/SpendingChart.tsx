"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { getCategoryColor } from "@/lib/categories";

interface SpendingData {
  category: string;
  total: number;
}

interface SpendingChartProps {
  data: SpendingData[];
}

export default function SpendingChart({ data }: SpendingChartProps) {
  return (
    <div className="bg-card-bg rounded-xl p-6 border border-border shadow-sm">
      <h3 className="font-semibold mb-4">Gastos por categor&iacute;a</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="total"
              nameKey="category"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.category}
                  fill={getCategoryColor(entry.category)}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                `$${Number(value).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
              }
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
