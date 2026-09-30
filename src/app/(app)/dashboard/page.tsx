import { DoorOpen, UserCheck, Ticket, DollarSign, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, Card, CardHeader } from "@/components/ui/Card";
import { Badge, StatusBadge, StatusMaps } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/supabase/dashboard";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getAcessoAtual } from "@/lib/auth/acesso-atual";
import { DashboardCardId, permissaoDoCard, temPermissao } from "@/lib/permissoes";
import { DashboardCharts } from "./charts";

// KPIs e listas dependem do dia/mês corrente — não pode ser pré-renderizada no build.
export const dynamic = "force-dynamic";

function trend(variacao: number | null, rotulo: string) {
  if (variacao === null) return undefined;
  return { value: `${Math.abs(variacao)}% ${rotulo}`, positive: variacao >= 0 };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const [d, acesso] = await Promise.all([getDashboardData(supabase), getAcessoAtual()]);
  // Cada card é uma permissão do grupo (Configurações → Grupos e permissões).
  const ver = (id: DashboardCardId) => temPermissao(acesso, permissaoDoCard(id));
  const algumKpi = (["entradas_hoje", "associados_ativos", "ingressos_hoje", "faturamento_mes", "mensalidades_aberto"] as const).some(ver);
  const algumGrafico = ver("grafico_entradas") || ver("grafico_faturamento");
  const algumaLista = (["entradas_recentes", "ultimos_pagamentos", "mensalidades_atraso"] as const).some(ver);
  const algumaListaInferior = ver("ingressos_recentes") || ver("despesas_proximas");

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral da operação do parque hoje" />

      {!algumKpi && !algumGrafico && !algumaLista && !algumaListaInferior && (
        <Card>
          <p className="px-4 py-10 text-center text-sm text-gray-400">Nenhum card do Dashboard está liberado para o seu grupo de acesso.</p>
        </Card>
      )}

      {algumKpi && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {ver("entradas_hoje") && (
            <KpiCard
              label="Entradas hoje"
              value={d.entradasHoje.toLocaleString("pt-BR")}
              icon={DoorOpen}
              tone="info"
              hint="Ingressos utilizados hoje"
              trend={trend(d.entradasHojeVariacao, "vs ontem")}
            />
          )}
          {ver("associados_ativos") && (
            <KpiCard label="Associados ativos" value={d.associadosAtivos.toLocaleString("pt-BR")} icon={UserCheck} tone="success" />
          )}
          {ver("ingressos_hoje") && (
            <KpiCard label="Ingressos vendidos hoje" value={d.ingressosVendidosHoje.toLocaleString("pt-BR")} icon={Ticket} tone="primary" />
          )}
          {ver("faturamento_mes") && (
            <KpiCard
              label="Faturamento (mês)"
              value={formatCurrency(d.faturamentoMes)}
              icon={DollarSign}
              tone="success"
              trend={trend(d.faturamentoMesVariacao, "vs mês anterior")}
            />
          )}
          {ver("mensalidades_aberto") && (
            <KpiCard
              label="Mensalidades em aberto"
              value={d.mensalidadesEmAberto.toLocaleString("pt-BR")}
              icon={AlertTriangle}
              tone="warning"
            />
          )}
        </div>
      )}

      {algumGrafico && (
        <div className={`${algumKpi ? "mt-5 " : ""}grid grid-cols-1 gap-4 xl:grid-cols-2`}>
          {/* Só os dados liberados chegam ao navegador (o gráfico é um componente de cliente). */}
          <DashboardCharts
            entradasSemana={ver("grafico_entradas") ? d.entradasSemana : null}
            faturamentoMensal={ver("grafico_faturamento") ? d.faturamentoMensal : null}
          />
        </div>
      )}

      {algumaLista && (
        <div className={`${algumKpi || algumGrafico ? "mt-5 " : ""}grid grid-cols-1 gap-4 lg:grid-cols-3`}>
          {ver("entradas_recentes") && (
            <Card>
              <CardHeader title="Entradas recentes" subtitle="Últimos acessos autorizados" />
              <div className="divide-y divide-gray-100">
                {d.entradasRecentes.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma entrada hoje ainda.</p>
                )}
                {d.entradasRecentes.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800">{e.quem}</p>
                      <p className="text-xs text-gray-500">
                        {e.origem} · {e.tipo}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {new Date(e.registradoEm).toLocaleTimeString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {ver("ultimos_pagamentos") && (
            <Card>
              <CardHeader title="Últimos pagamentos" subtitle="Recebimentos do mês" />
              <div className="divide-y divide-gray-100">
                {d.ultimosPagamentos.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhum recebimento este mês.</p>
                )}
                {d.ultimosPagamentos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800">{p.origem}</p>
                      <p className="text-xs text-gray-500">{p.forma}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium ${p.valor < 0 ? "text-danger-600" : "text-success-700"}`}>
                      {formatCurrency(p.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {ver("mensalidades_atraso") && (
            <Card>
              <CardHeader title="Mensalidades em atraso" subtitle="Requer atenção" />
              <div className="divide-y divide-gray-100">
                {d.mensalidadesAtrasadas.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma mensalidade em atraso.</p>
                )}
                {d.mensalidadesAtrasadas.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800">{m.associadoNome}</p>
                      <p className="text-xs text-gray-500">Venc. {formatDate(m.vencimento)}</p>
                    </div>
                    <StatusBadge status={m.status} map={StatusMaps.mensalidade} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {algumaListaInferior && (
        <div className={`${algumKpi || algumGrafico || algumaLista ? "mt-5 " : ""}grid grid-cols-1 gap-4 lg:grid-cols-2`}>
          {ver("ingressos_recentes") && (
            <Card>
              <CardHeader title="Ingressos vendidos recentemente" />
              <div className="divide-y divide-gray-100">
                {d.ingressosRecentes.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhum ingresso vendido ainda.</p>
                )}
                {d.ingressosRecentes.map((i) => (
                  <div key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800">{i.tipo}</p>
                      <p className="truncate text-xs text-gray-500">
                        {i.comprador} · {i.numero}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-gray-500">{formatCurrency(i.valor)}</span>
                      <StatusBadge status={i.status} map={StatusMaps.ingresso} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {ver("despesas_proximas") && (
            <Card>
              <CardHeader title="Despesas próximas" />
              <div className="divide-y divide-gray-100">
                {d.despesasProximas.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma despesa pendente.</p>
                )}
                {d.despesasProximas.map((despesa) => (
                  <div key={despesa.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800">{despesa.descricao}</p>
                      <p className="text-xs text-gray-500">
                        {despesa.categoria} · Venc. {formatDate(despesa.vencimento)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-gray-500">{formatCurrency(despesa.valor)}</span>
                      <Badge tone={despesa.status === "Pago" ? "success" : despesa.status === "Vencido" ? "danger" : "warning"}>
                        {despesa.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
