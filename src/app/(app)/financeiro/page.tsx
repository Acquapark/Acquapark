"use client";

import { useState } from "react";
import { Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, KpiCard } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Thead, Tbody, Th, Tr, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { associados, despesas, ingressos } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";

type TabKey = "receber" | "recebimentos" | "despesas" | "fluxo";

export default function FinanceiroPage() {
  const [tab, setTab] = useState<TabKey>("receber");

  const contasReceber = [
    ...associados.flatMap((a) =>
      a.mensalidades
        .filter((m) => m.status === "Pendente" || m.status === "Vencido")
        .map((m) => ({ ...m, origem: `Mensalidade — ${a.nome}` })),
    ),
    ...ingressos
      .filter((i) => i.status === "Disponível")
      .map((i) => ({ id: i.id, vencimento: i.dataUtilizacao, valor: i.valor, status: "Pendente" as const, origem: `Ingresso — ${i.comprador}` })),
  ];

  const recebimentos = associados
    .flatMap((a) => a.mensalidades.filter((m) => m.status === "Pago").map((m) => ({ ...m, origem: a.nome })))
    .concat(ingressos.filter((i) => i.status === "Utilizado").map((i) => ({ id: i.id, vencimento: i.dataUtilizacao, valor: i.valor, status: "Pago" as const, formaPagamento: "Cartão", pagamentoEm: i.dataUtilizacao, origem: i.comprador })));

  const totalReceitas = recebimentos.reduce((sum, r) => sum + r.valor, 0);
  const totalDespesas = despesas.reduce((sum, d) => sum + d.valor, 0);
  const saldo = totalReceitas - totalDespesas;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Contas a receber, recebimentos, despesas e fluxo de caixa"
        action={
          tab === "despesas" ? (
            <Button>
              <Plus size={16} />
              Nova Despesa
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Receitas (mês)" value={formatCurrency(totalReceitas)} icon={TrendingUp} tone="success" />
        <KpiCard label="Despesas (mês)" value={formatCurrency(totalDespesas)} icon={TrendingDown} tone="danger" />
        <KpiCard label="Saldo" value={formatCurrency(saldo)} icon={Wallet} tone={saldo >= 0 ? "primary" : "danger"} />
      </div>

      <Card className="mt-5">
        <div className="px-4">
          <Tabs
            tabs={[
              { key: "receber", label: "Contas a Receber" },
              { key: "recebimentos", label: "Recebimentos" },
              { key: "despesas", label: "Despesas" },
              { key: "fluxo", label: "Fluxo de Caixa" },
            ]}
            active={tab}
            onChange={(k) => setTab(k as TabKey)}
          />
        </div>

        {tab === "receber" && (
          <Table>
            <Thead>
              <tr>
                <Th>Origem</Th>
                <Th>Vencimento</Th>
                <Th>Valor</Th>
                <Th>Status</Th>
              </tr>
            </Thead>
            <Tbody>
              {contasReceber.map((c) => (
                <Tr key={c.id}>
                  <Td>{c.origem}</Td>
                  <Td>{formatDate(c.vencimento)}</Td>
                  <Td>{formatCurrency(c.valor)}</Td>
                  <Td>
                    <Badge tone={c.status === "Vencido" ? "danger" : "warning"}>{c.status}</Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        {tab === "recebimentos" && (
          <Table>
            <Thead>
              <tr>
                <Th>Data</Th>
                <Th>Origem</Th>
                <Th>Valor</Th>
                <Th>Forma de pagamento</Th>
                <Th>Responsável</Th>
              </tr>
            </Thead>
            <Tbody>
              {recebimentos.map((r) => (
                <Tr key={r.id}>
                  <Td>{r.pagamentoEm ? formatDate(r.pagamentoEm) : "—"}</Td>
                  <Td>{r.origem}</Td>
                  <Td>{formatCurrency(r.valor)}</Td>
                  <Td>{r.formaPagamento}</Td>
                  <Td>Sistema</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        {tab === "despesas" && (
          <Table>
            <Thead>
              <tr>
                <Th>Descrição</Th>
                <Th>Categoria</Th>
                <Th>Valor</Th>
                <Th>Vencimento</Th>
                <Th>Status</Th>
              </tr>
            </Thead>
            <Tbody>
              {despesas.map((d) => (
                <Tr key={d.id}>
                  <Td className="font-medium text-gray-800">{d.descricao}</Td>
                  <Td>{d.categoria}</Td>
                  <Td>{formatCurrency(d.valor)}</Td>
                  <Td>{formatDate(d.vencimento)}</Td>
                  <Td>
                    <Badge tone={d.status === "Pago" ? "success" : d.status === "Vencido" ? "danger" : "warning"}>{d.status}</Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        {tab === "fluxo" && (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-gray-500">Entradas</p>
              <p className="mt-1 text-xl font-semibold text-success-700">{formatCurrency(totalReceitas)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500">Saídas</p>
              <p className="mt-1 text-xl font-semibold text-danger-700">{formatCurrency(totalDespesas)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500">Saldo do período</p>
              <p className={`mt-1 text-xl font-semibold ${saldo >= 0 ? "text-primary-700" : "text-danger-700"}`}>
                {formatCurrency(saldo)}
              </p>
            </Card>
          </div>
        )}
      </Card>
    </div>
  );
}
