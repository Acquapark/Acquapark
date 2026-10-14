"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export type EstadoDia = "desabilitado" | "disponivel" | "marcado";

/** "2026-10" -> "2026-11" (delta = +1) ou "2026-09" (delta = -1). */
export function somarMeses(mes: string, delta: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const total = ano * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Calendário de um mês em português, sem depender do seletor de data do
 * navegador (que não deixa bloquear dias específicos). Quem usa decide o
 * estado de cada dia: desabilitado (cinza, sem clique), disponível ou marcado.
 */
export function Calendario({
  mes,
  onMudarMes,
  mesMinimo,
  mesMaximo,
  estadoDoDia,
  onClicarDia,
  tamanho = "normal",
}: {
  /** "YYYY-MM" */
  mes: string;
  onMudarMes: (mes: string) => void;
  mesMinimo?: string;
  mesMaximo?: string;
  estadoDoDia: (data: string) => EstadoDia;
  onClicarDia: (data: string) => void;
  tamanho?: "normal" | "grande";
}) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const diasNoMes = new Date(Date.UTC(ano, numeroMes, 0)).getUTCDate();
  const primeiroDiaSemana = new Date(Date.UTC(ano, numeroMes - 1, 1)).getUTCDay();
  const podeVoltar = !mesMinimo || mes > mesMinimo;
  const podeAvancar = !mesMaximo || mes < mesMaximo;

  const celulas: (string | null)[] = [
    ...Array.from({ length: primeiroDiaSemana }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMudarMes(somarMeses(mes, -1))}
          disabled={!podeVoltar}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-30"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold capitalize text-gray-800">
          {MESES[numeroMes - 1]} de {ano}
        </span>
        <button
          type="button"
          onClick={() => onMudarMes(somarMeses(mes, 1))}
          disabled={!podeAvancar}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-30"
          aria-label="Próximo mês"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="py-1 text-[11px] font-medium text-gray-400">
            {d}
          </span>
        ))}
        {celulas.map((data, i) => {
          if (!data) return <span key={`vazio-${i}`} />;
          const estado = estadoDoDia(data);
          return (
            <button
              key={data}
              type="button"
              disabled={estado === "desabilitado"}
              onClick={() => onClicarDia(data)}
              aria-pressed={estado === "marcado"}
              aria-label={data.split("-").reverse().join("/")}
              className={cn(
                "mx-auto flex items-center justify-center rounded-full text-sm transition-colors",
                tamanho === "grande" ? "h-10 w-10" : "h-9 w-9",
                estado === "marcado" && "bg-primary-600 font-semibold text-white",
                estado === "disponivel" && "font-medium text-gray-900 hover:bg-primary-50 ring-1 ring-inset ring-primary-200",
                estado === "desabilitado" && "cursor-default text-gray-300",
              )}
            >
              {Number(data.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
