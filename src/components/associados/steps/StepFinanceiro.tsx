"use client";

import { useState } from "react";
import { CreditCard, FileWarning, Receipt } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { StatusBadge, StatusMaps } from "@/components/ui/Badge";
import { Mensalidade } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { RegistrarPagamentoModal } from "@/components/financeiro/RegistrarPagamentoModal";

export function StepFinanceiro({
  mensalidades,
  associadoId,
}: {
  mensalidades: Mensalidade[];
  associadoId?: string;
}) {
  const { pode } = useAcesso();
  const pagas = mensalidades.filter((m) => m.status === "Pago");
  const [registrando, setRegistrando] = useState<Mensalidade | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Mensalidades</p>
        <Table className="rounded-[6px] border border-gray-200">
          <Thead>
            <tr>
              <Th>Vencimento</Th>
              <Th>Valor</Th>
              <Th>Status</Th>
              <Th>Pagamento</Th>
              <Th>Ações</Th>
            </tr>
          </Thead>
          <Tbody>
            {mensalidades.length === 0 && (
              <TableEmpty colSpan={5} message="Nenhuma mensalidade gerada ainda. Será criada após salvar o cadastro." />
            )}
            {mensalidades.map((m) => (
              <Tr key={m.id}>
                <Td>{formatDate(m.vencimento)}</Td>
                <Td>{formatCurrency(m.valor)}</Td>
                <Td>
                  <StatusBadge status={m.status} map={StatusMaps.mensalidade} />
                </Td>
                <Td>{m.pagamentoEm ? formatDate(m.pagamentoEm) : "—"}</Td>
                <Td>
                  <div className="flex gap-1.5">
                    {m.status !== "Pago" && pode("contas_receber.receber") && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setRegistrando(m)}
                        disabled={!associadoId}
                      >
                        <CreditCard size={13} />
                        Registrar
                      </Button>
                    )}
                    {m.status === "Pendente" && (
                      <Button variant="ghost" size="sm" disabled title="Requer integração com gateway de pagamento/cobrança">
                        <FileWarning size={13} />
                        Cobrar
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Receipt size={15} className="text-gray-400" />
          Histórico de pagamentos
        </p>
        <Table className="rounded-[6px] border border-gray-200">
          <Thead>
            <tr>
              <Th>Data</Th>
              <Th>Valor</Th>
              <Th>Forma</Th>
              <Th>Referência</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {pagas.length === 0 && <TableEmpty colSpan={5} message="Sem pagamentos registrados." />}
            {pagas.map((m) => (
              <Tr key={m.id}>
                <Td>{m.pagamentoEm ? formatDate(m.pagamentoEm) : "—"}</Td>
                <Td>{formatCurrency(m.valor)}</Td>
                <Td>{m.formaPagamento}</Td>
                <Td>REF-{m.id.toUpperCase()}</Td>
                <Td>
                  <StatusBadge status={m.status} map={StatusMaps.mensalidade} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      <RegistrarPagamentoModal
        mensalidade={
          registrando && associadoId
            ? { id: registrando.id, associadoId, vencimento: registrando.vencimento, valor: registrando.valor }
            : null
        }
        onClose={() => setRegistrando(null)}
      />
    </div>
  );
}
