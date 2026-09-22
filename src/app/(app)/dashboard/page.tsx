import { DoorOpen, UserCheck, Ticket, DollarSign, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, Card, CardHeader } from "@/components/ui/Card";
import { Badge, StatusBadge, StatusMaps } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/supabase/dashboard";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DashboardCharts } from "./charts";

// KPIs e listas dependem do dia/mês corrente — não pode ser pré-renderizada no build.
export const dynamic = "force-dynamic";

function trend(variacao: number | null, rotulo: string) {
  if (variacao === null) return undefined;
  return { value: `${Math.abs(variacao)}% ${rotulo}`, positive: variacao >= 0 };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const d = await getDashboardData(supabase);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral da operação do parque hoje" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Entradas hoje"
          value={d.entradasHoje.toLocaleString("pt-BR")}
          icon={DoorOpen}
          tone="info"
          hint="Ingressos utilizados hoje"
          trend={trend(d.entradasHojeVariacao, "vs ontem")}
        />
        <KpiCard label="Associados ativos" value={d.associadosAtivos.toLocaleString("pt-BR")} icon={UserCheck} tone="success" />
        <KpiCard label="Ingressos vendidos hoje" value={d.ingressosVendidosHoje.toLocaleString("pt-BR")} icon={Ticket} tone="primary" />
        <KpiCard
          label="Faturamento (mês)"
          value={formatCurrency(d.faturamentoMes)}
          icon={DollarSign}
          tone="success"
          trend={trend(d.faturamentoMesVariacao, "vs mês anterior")}
        />
        <KpiCard label="Mensalidades em aberto" value={d.mensalidadesEmAberto.toLocaleString("pt-BR")} icon={AlertTriangle} tone="warning" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DashboardCharts entradasSemana={d.entradasSemana} faturamentoMensal={d.faturamentoMensal} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Entradas recentes" subtitle="Últimos acessos autorizados" />
          <div className="divide-y divide-gray-100">
            {d.entradasRecentes.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma entrada hoje ainda.</p>}
            {d.entradasRecentes.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-800">{e.quem}</p>
                  <p className="text-xs text-gray-500">
                    {e.origem} · {e.tipo}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(e.registradoEm).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Últimos pagamentos" subtitle="Recebimentos do mês" />
          <div className="divide-y divide-gray-100">
            {d.ultimosPagamentos.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhum recebimento este mês.</p>}
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

        <Card>
          <CardHeader title="Mensalidades em atraso" subtitle="Requer atenção" />
          <div className="divide-y divide-gray-100">
            {d.mensalidadesAtrasadas.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma mensalidade em atraso.</p>}
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
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ingressos vendidos recentemente" />
          <div className="divide-y divide-gray-100">
            {d.ingressosRecentes.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhum ingresso vendido ainda.</p>}
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

        <Card>
          <CardHeader title="Despesas próximas" />
          <div className="divide-y divide-gray-100">
            {d.despesasProximas.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma despesa pendente.</p>}
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
                  <Badge tone={despesa.status === "Pago" ? "success" : despesa.status === "Vencido" ? "danger" : "warning"}>{despesa.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
