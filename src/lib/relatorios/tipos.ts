import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export type TipoColuna = "texto" | "moeda" | "numero" | "data" | "dataHora" | "percentual";
export type Valor = string | number | null;

export interface Coluna {
  key: string;
  label: string;
  tipo?: TipoColuna;
}

export interface Secao {
  titulo?: string;
  colunas: Coluna[];
  linhas: Record<string, Valor>[];
  /** Linha de totais (mesmas chaves das colunas). */
  totais?: Record<string, Valor>;
}

export interface Relatorio {
  id: string;
  titulo: string;
  /** null quando o relatório não usa período (ex: base de associados). */
  periodo: { de: string; ate: string } | null;
  resumo: { label: string; valor: string }[];
  secoes: Secao[];
  avisos: string[];
  geradoEm: string;
}

export const RELATORIOS = [
  { id: "vendas", nome: "Vendas", descricao: "Ingressos e mensalidades vendidos no período" },
  { id: "entradas", nome: "Entradas", descricao: "Total de entradas registradas por dia" },
  { id: "saidas", nome: "Saídas", descricao: "Total de saídas registradas por dia" },
  { id: "associados", nome: "Associados", descricao: "Base de associados ativos, pendentes e inativos" },
  { id: "inadimplencia", nome: "Inadimplência", descricao: "Mensalidades vencidas por associado" },
  { id: "faturamento", nome: "Faturamento", descricao: "Receita consolidada por dia" },
  { id: "utilizacao", nome: "Utilização do parque", descricao: "Frequência e horários de pico" },
  { id: "pagamentos", nome: "Formas de pagamento", descricao: "Distribuição de recebimentos por forma de pagamento" },
  { id: "acessos", nome: "Histórico de acessos", descricao: "Log completo de entradas, saídas e reentradas" },
] as const;

export type RelatorioId = (typeof RELATORIOS)[number]["id"];

export function relatorioIdValido(id: string): id is RelatorioId {
  return RELATORIOS.some((r) => r.id === id);
}

/** Texto exibido para uma célula, conforme o tipo da coluna. */
export function formatarCelula(valor: Valor | undefined, tipo: TipoColuna = "texto"): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  // Rótulos como "Total" (linha de totais) passam direto, seja qual for o tipo da coluna.
  if (typeof valor === "string" && tipo !== "texto") {
    const ehData = /^\d{4}-\d{2}-\d{2}/.test(valor);
    const ehNumero = valor.trim() !== "" && !Number.isNaN(Number(valor));
    if (!ehData && !ehNumero) return valor;
  }
  switch (tipo) {
    case "moeda":
      return formatCurrency(Number(valor));
    case "numero":
      return Number(valor).toLocaleString("pt-BR");
    case "percentual":
      return `${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    case "data":
      return formatDate(String(valor));
    case "dataHora":
      return formatDateTime(String(valor));
    default:
      return String(valor);
  }
}

export function rotuloPeriodo(periodo: Relatorio["periodo"]): string {
  return periodo ? `${formatDate(periodo.de)} a ${formatDate(periodo.ate)}` : "Posição atual (sem período)";
}
