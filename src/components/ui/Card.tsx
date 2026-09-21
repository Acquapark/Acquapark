import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-[6px] border border-gray-200 bg-white", className)}>{children}</div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral" | "info";
  trend?: { value: string; positive: boolean };
  /** Linha de apoio discreta sob o valor (ex: detalhe de como o número foi calculado). */
  hint?: string;
}

const toneIconClasses: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  neutral: "bg-gray-100 text-gray-600",
  info: "bg-info-50 text-primary-600",
};

export function KpiCard({ label, value, icon: Icon, tone = "primary", trend, hint }: KpiCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="mt-1.5 truncate text-xl font-semibold text-gray-900 lg:text-2xl" title={value}>
            {value}
          </p>
        </div>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-[6px]", toneIconClasses[tone])}>
          <Icon size={18} strokeWidth={2} />
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-gray-400">{hint}</p>}
      {trend && (
        <p className={cn("mt-2 text-xs font-medium", trend.positive ? "text-success-600" : "text-danger-600")}>
          {trend.positive ? "▲" : "▼"} {trend.value}
        </p>
      )}
    </Card>
  );
}
