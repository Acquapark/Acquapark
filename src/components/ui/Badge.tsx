import { cn } from "@/lib/utils";

export type StatusTone = "success" | "danger" | "warning" | "info" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-success-50 text-success-700 border-success-600/20",
  danger: "bg-danger-50 text-danger-700 border-danger-600/20",
  warning: "bg-warning-50 text-warning-700 border-warning-600/20",
  info: "bg-info-50 text-primary-700 border-primary-600/20",
  neutral: "bg-gray-100 text-gray-600 border-gray-300",
};

const dotClasses: Record<StatusTone, string> = {
  success: "bg-success-600",
  danger: "bg-danger-600",
  warning: "bg-warning-600",
  info: "bg-primary-600",
  neutral: "bg-gray-400",
};

export function Badge({
  tone = "neutral",
  children,
  dot = true,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[tone])} />}
      {children}
    </span>
  );
}

// Domain-specific status mappers so pages don't repeat the tone logic.
const associadoStatusTone: Record<string, StatusTone> = {
  Ativo: "success",
  Pendente: "warning",
  Inadimplente: "danger",
  Suspenso: "danger",
  Inativo: "neutral",
};

const mensalidadeStatusTone: Record<string, StatusTone> = {
  Pago: "success",
  Pendente: "warning",
  Vencido: "danger",
  Cancelado: "neutral",
};

const acessoResultadoTone: Record<string, StatusTone> = {
  Autorizado: "success",
  Negado: "danger",
  Bloqueado: "danger",
};

const ingressoStatusTone: Record<string, StatusTone> = {
  Disponível: "info",
  Utilizado: "success",
  Cancelado: "neutral",
  Expirado: "danger",
};

export function StatusBadge({ status, map }: { status: string; map: Record<string, StatusTone> }) {
  return <Badge tone={map[status] ?? "neutral"}>{status}</Badge>;
}

export const StatusMaps = {
  associado: associadoStatusTone,
  mensalidade: mensalidadeStatusTone,
  acesso: acessoResultadoTone,
  ingresso: ingressoStatusTone,
};
