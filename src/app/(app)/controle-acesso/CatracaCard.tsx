import { cn } from "@/lib/utils";
import { Catraca } from "@/types";

const statusStyles: Record<Catraca["status"], { dot: string; text: string }> = {
  Online: { dot: "bg-success-600", text: "text-success-600" },
  Offline: { dot: "bg-danger-600", text: "text-danger-600" },
  Manutenção: { dot: "bg-warning-600", text: "text-warning-600" },
};

export function CatracaCard({ catraca }: { catraca: Catraca }) {
  const styles = statusStyles[catraca.status];
  return (
    <div className="rounded-[6px] border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">
          {catraca.nome} — {catraca.tipo}
        </p>
        <span className={cn("h-2 w-2 rounded-full", styles.dot)} />
      </div>
      <p className="mt-0.5 text-xs text-gray-500">{catraca.local}</p>
      <p className={cn("mt-2 text-xs font-medium", styles.text)}>● {catraca.status}</p>
    </div>
  );
}
