import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "text-accent",
}: StatCardProps) {
  return (
    <div className="bg-card-bg rounded-xl p-6 border border-border shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-foreground/50 font-medium">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-foreground/40 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p
              className={`text-xs mt-2 font-medium ${
                trend.value >= 0 ? "text-danger" : "text-success"
              }`}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-accent/10 ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
