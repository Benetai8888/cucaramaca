export const CATEGORIES = [
  { name: "Comida", color: "#f97316", icon: "🍔" },
  { name: "Transporte", color: "#3b82f6", icon: "🚗" },
  { name: "Entretenimiento", color: "#8b5cf6", icon: "🎬" },
  { name: "Compras", color: "#ec4899", icon: "🛍️" },
  { name: "Salud", color: "#10b981", icon: "🏥" },
  { name: "Hogar", color: "#f59e0b", icon: "🏠" },
  { name: "Educación", color: "#06b6d4", icon: "📚" },
  { name: "Servicios", color: "#6366f1", icon: "💡" },
  { name: "Suscripciones", color: "#d946ef", icon: "📱" },
  { name: "Otros", color: "#64748b", icon: "📦" },
] as const;

export function getCategoryColor(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.color ?? "#64748b";
}

export function getCategoryIcon(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.icon ?? "📦";
}
