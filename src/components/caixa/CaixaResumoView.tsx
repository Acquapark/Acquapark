import { Coins, MinusCircle, PlusCircle, ShoppingCart, Undo2, Wallet } from "lucide-react";
import { Card, CardHeader, KpiCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { CaixaResumo } from "@/types";

export function CaixaResumoView({ resumo }: { resumo: CaixaResumo }) {
  const { caixa } = resumo;
  const formas = Object.entries(resumo.porForma).sort((a, b) => b[1] - a[1]);
  const fechado = caixa.status === "Fechado";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Fundo de abertura" value={formatCurrency(caixa.valorAbertura)} icon={Wallet} tone="neutral" />
        <KpiCard label="Suprimentos" value={formatCurrency(resumo.suprimentos)} icon={PlusCircle} tone="success" />
        <KpiCard label="Sangrias" value={formatCurrency(resumo.sangrias)} icon={MinusCircle} tone="danger" />
        <KpiCard label="Vendas" value={formatCurrency(resumo.vendas)} icon={ShoppingCart} tone="primary" />
        <KpiCard label="Estornos" value={formatCurrency(resumo.estornos)} icon={Undo2} tone="warning" />
        <KpiCard
          label={fechado ? "Dinheiro esperado (fechamento)" : "Dinheiro em caixa"}
          value={formatCurrency(resumo.dinheiroEsperado)}
          icon={Coins}
          tone="info"
        />
      </div>

      {fechado && (
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Contado</p>
              <p className="font-medium text-gray-800">{formatCurrency(caixa.valorContado ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Diferença</p>
              <p
                className={
                  (caixa.diferenca ?? 0) === 0
                    ? "font-medium text-success-700"
                    : "font-medium text-danger-600"
                }
              >
                {formatCurrency(caixa.diferenca ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Fechado em</p>
              <p className="font-medium text-gray-800">{caixa.fechadoEm ? formatDateTime(caixa.fechadoEm) : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Reaberturas</p>
              <p className="font-medium text-gray-800">{caixa.reaberturas}</p>
            </div>
          </div>
          {caixa.observacoes && (
            <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-600">
              <span className="font-medium">Observações:</span> {caixa.observacoes}
            </p>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recebimentos por forma de pagamento" subtitle="Vendas menos estornos" />
          <div className="divide-y divide-gray-100">
            {formas.length === 0 && <p className="px-4 py-5 text-center text-sm text-gray-400">Nenhum recebimento ainda.</p>}
            {formas.map(([forma, total]) => (
              <div key={forma} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-700">{forma}</span>
                <span className="font-medium text-gray-900">{formatCurrency(total)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Suprimentos e sangrias" />
          <div className="divide-y divide-gray-100">
            {resumo.movimentos.length === 0 && (
              <p className="px-4 py-5 text-center text-sm text-gray-400">Nenhuma movimentação.</p>
            )}
            {resumo.movimentos.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={m.tipo === "Suprimento" ? "success" : "danger"}>{m.tipo}</Badge>
                    <span className="text-xs text-gray-400">{formatDateTime(m.createdAt)}</span>
                  </div>
                  {m.motivo && <p className="mt-0.5 truncate text-xs text-gray-500">{m.motivo}</p>}
                </div>
                <span className={m.tipo === "Suprimento" ? "font-medium text-success-700" : "font-medium text-danger-600"}>
                  {m.tipo === "Suprimento" ? "+" : "−"} {formatCurrency(m.valor)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Lançamentos do caixa" subtitle="Vendas de ingresso e estornos" />
        <div className="divide-y divide-gray-100">
          {resumo.lancamentos.length === 0 && (
            <p className="px-4 py-5 text-center text-sm text-gray-400">Nenhum lançamento neste caixa.</p>
          )}
          {resumo.lancamentos.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div>
                <p className="font-medium text-gray-800">{l.referencia ?? "—"}</p>
                <p className="text-xs text-gray-500">
                  {l.forma} · {formatDateTime(l.pagoEm)}
                </p>
              </div>
              <span className={l.valor < 0 ? "font-medium text-danger-600" : "font-medium text-gray-900"}>
                {formatCurrency(l.valor)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
