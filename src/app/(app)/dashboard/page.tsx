import { Users, DoorOpen, UserCheck, Ticket, DollarSign, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, Card, CardHeader } from "@/components/ui/Card";
import { Badge, StatusBadge, StatusMaps } from "@/components/ui/Badge";
import { associados, despesas, entradasSemana, faturamentoMensal, ingressos } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DashboardCharts } from "./charts";

export default function DashboardPage() {
  const mensalidadesEmAberto = associados
    .flatMap((a) => a.mensalidades.map((m) => ({ ...m, associado: a.nome })))
    .filter((m) => m.status === "Vencido" || m.status === "Pendente");

  const ultimosPagamentos = associados
    .flatMap((a) => a.mensalidades.filter((m) => m.status === "Pago").map((m) => ({ ...m, associado: a.nome })))
    .sort((a, b) => (b.pagamentoEm ?? "").localeCompare(a.pagamentoEm ?? ""))
    .slice(0, 5);

  const entradasRecentes = associados
    .flatMap((a) => a.acessos.filter((ac) => ac.tipo === "Entrada").map((ac) => ({ ...ac, associado: a.nome })))
    .slice(0, 5);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral da operação do parque hoje" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Pessoas no parque" value="284" icon={Users} tone="primary" />
        <KpiCard label="Entradas hoje" value="412" icon={DoorOpen} tone="info" trend={{ value: "12% vs ontem", positive: true }} />
        <KpiCard label="Associados ativos" value="1.248" icon={UserCheck} tone="success" />
        <KpiCard label="Ingressos vendidos" value="97" icon={Ticket} tone="primary" />
        <KpiCard label="Faturamento (mês)" value={formatCurrency(97600)} icon={DollarSign} tone="success" trend={{ value: "8% vs mês anterior", positive: false }} />
        <KpiCard label="Mensalidades em aberto" value="34" icon={AlertTriangle} tone="warning" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DashboardCharts entradasSemana={entradasSemana} faturamentoMensal={faturamentoMensal} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Entradas recentes" subtitle="Últimos acessos registrados" />
          <div className="divide-y divide-gray-100">
            {entradasRecentes.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{e.associado}</p>
                  <p className="text-xs text-gray-500">{e.catraca}</p>
                </div>
                <span className="text-xs text-gray-400">{e.horario}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Últimos pagamentos" subtitle="Mensalidades quitadas recentemente" />
          <div className="divide-y divide-gray-100">
            {ultimosPagamentos.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{p.associado}</p>
                  <p className="text-xs text-gray-500">{p.formaPagamento}</p>
                </div>
                <span className="text-xs font-medium text-success-700">{formatCurrency(p.valor)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Mensalidades em atraso" subtitle="Requer atenção" />
          <div className="divide-y divide-gray-100">
            {mensalidadesEmAberto.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{m.associado}</p>
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
            {ingressos.slice(0, 4).map((i) => (
              <div key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{i.tipo}</p>
                  <p className="text-xs text-gray-500">{i.comprador} · {i.numero}</p>
                </div>
                <div className="flex items-center gap-2">
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
            {despesas.slice(0, 4).map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{d.descricao}</p>
                  <p className="text-xs text-gray-500">{d.categoria} · Venc. {formatDate(d.vencimento)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{formatCurrency(d.valor)}</span>
                  <Badge tone={d.status === "Pago" ? "success" : d.status === "Vencido" ? "danger" : "warning"}>{d.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
