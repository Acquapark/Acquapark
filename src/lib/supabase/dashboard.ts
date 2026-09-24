import { SupabaseClient } from "@supabase/supabase-js";
import { diaDaSemana, hojeBR, janelaDoDiaBR, mesAnterior, mesAtualBR, somarDias, ultimosMeses } from "@/lib/datas-br";
import { getAcessosRecentes, AcessoRecente, getIngressos } from "./bilheteria";
import { getContasReceber, getDespesas, getFaturamentoPorMes, getRecebimentos, ContaReceber, Recebimento } from "./financeiro";
import { Despesa, Ingresso } from "@/types";

const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export interface DashboardData {
  entradasHoje: number;
  entradasHojeVariacao: number | null;
  associadosAtivos: number;
  ingressosVendidosHoje: number;
  faturamentoMes: number;
  faturamentoMesVariacao: number | null;
  mensalidadesEmAberto: number;
  entradasRecentes: AcessoRecente[];
  ultimosPagamentos: Recebimento[];
  mensalidadesAtrasadas: ContaReceber[];
  ingressosRecentes: Ingresso[];
  despesasProximas: Despesa[];
  entradasSemana: { dia: string; entradas: number }[];
  faturamentoMensal: { mes: string; valor: number }[];
}

/** Diferença percentual de `atual` sobre `anterior`; null quando não há base de comparação. */
function variacao(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

/** Ingressos utilizados num dia qualquer (data de utilização, não de venda) — base de "Entradas hoje". */
async function contarIngressosUtilizadosNoDia(supabase: SupabaseClient, dia: string): Promise<number> {
  const { count } = await supabase
    .from("ingressos")
    .select("id", { count: "exact", head: true })
    .eq("data_utilizacao", dia)
    .eq("status", "Utilizado");
  return count ?? 0;
}

/** Ingressos utilizados por dia, dos últimos 7 dias (hoje incluso), em ordem cronológica — mesma base do card "Entradas hoje". */
async function getEntradasSemana(supabase: SupabaseClient, hoje: string): Promise<{ dia: string; entradas: number }[]> {
  const primeiroDia = somarDias(hoje, -6);

  const { data, error } = await supabase
    .from("ingressos")
    .select("data_utilizacao")
    .eq("status", "Utilizado")
    .gte("data_utilizacao", primeiroDia)
    .lte("data_utilizacao", hoje)
    .limit(5000);
  if (error) throw error;

  const porDia = new Map<string, number>();
  for (const row of data as { data_utilizacao: string }[]) {
    porDia.set(row.data_utilizacao, (porDia.get(row.data_utilizacao) ?? 0) + 1);
  }

  return Array.from({ length: 7 }, (_, i) => {
    const dia = somarDias(primeiroDia, i);
    return { dia: DIAS_SEMANA_CURTO[diaDaSemana(dia).indice], entradas: porDia.get(dia) ?? 0 };
  });
}

/** Uma única leva de buscas alimenta todos os cartões do Dashboard. */
export async function getDashboardData(supabase: SupabaseClient): Promise<DashboardData> {
  const hoje = hojeBR();
  const ontem = somarDias(hoje, -1);
  const mesAtual = mesAtualBR();
  const mesPassado = mesAnterior(mesAtual);
  const { inicio: inicioHoje, fim: fimHoje } = janelaDoDiaBR(hoje);

  // Os 6 meses do gráfico de faturamento incluem mesAtual/mesPassado — reaproveitados abaixo, só os outros 4 são buscados aqui.
  const mesesGrafico = ultimosMeses(hoje, 6).slice().reverse();
  const outrosMeses = mesesGrafico.filter((m) => m !== mesAtual && m !== mesPassado);

  const [
    entradasHojeCount,
    entradasOntem,
    associadosAtivosRes,
    ingressosVendidosHojeRes,
    entradasRecentesRaw,
    contasReceber,
    despesas,
    ingressos,
    recebimentosMes,
    entradasSemana,
    faturamentoMesesAnteriores,
  ] = await Promise.all([
    contarIngressosUtilizadosNoDia(supabase, hoje),
    contarIngressosUtilizadosNoDia(supabase, ontem),
    supabase.from("associados").select("id", { count: "exact", head: true }).eq("status", "Ativo"),
    supabase.from("ingressos").select("id", { count: "exact", head: true }).gte("created_at", inicioHoje).lt("created_at", fimHoje),
    getAcessosRecentes(supabase, 20),
    getContasReceber(supabase),
    getDespesas(supabase),
    getIngressos(supabase),
    getRecebimentos(supabase, mesAtual),
    getEntradasSemana(supabase, hoje),
    // mesAtual não entra aqui — já veio completo (com detalhes) em recebimentosMes acima,
    // reaproveitado pra não duplicar a mesma janela de datas em duas consultas.
    getFaturamentoPorMes(supabase, [mesPassado, ...outrosMeses]),
  ]);

  const faturamentoMes = recebimentosMes.reduce((soma, r) => soma + r.valor, 0);
  const faturamentoMesPassado = faturamentoMesesAnteriores.get(mesPassado) ?? 0;

  const recebimentosPorMes = new Map<string, number>([[mesAtual, faturamentoMes], ...faturamentoMesesAnteriores]);
  const faturamentoMensal = mesesGrafico.map((mes) => ({
    mes: MESES_CURTO[Number(mes.slice(5, 7)) - 1],
    valor: recebimentosPorMes.get(mes) ?? 0,
  }));

  const entradasRecentes = entradasRecentesRaw
    .filter((a) => (a.tipo === "Entrada" || a.tipo === "Reentrada") && a.resultado === "Autorizado")
    .slice(0, 5);

  const mensalidadesAtrasadas = contasReceber
    .filter((c) => c.status === "Vencido")
    .slice(0, 5);

  const despesasProximas = despesas
    .filter((d) => d.status !== "Pago")
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .slice(0, 4);

  return {
    entradasHoje: entradasHojeCount,
    entradasHojeVariacao: variacao(entradasHojeCount, entradasOntem),
    associadosAtivos: associadosAtivosRes.count ?? 0,
    ingressosVendidosHoje: ingressosVendidosHojeRes.count ?? 0,
    faturamentoMes,
    faturamentoMesVariacao: variacao(faturamentoMes, faturamentoMesPassado),
    mensalidadesEmAberto: contasReceber.length,
    entradasRecentes,
    ultimosPagamentos: recebimentosMes.slice(0, 5),
    mensalidadesAtrasadas,
    ingressosRecentes: ingressos.slice(0, 4),
    despesasProximas,
    entradasSemana,
    faturamentoMensal,
  };
}
