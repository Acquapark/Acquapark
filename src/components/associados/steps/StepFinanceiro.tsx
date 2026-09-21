"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, FileWarning, Receipt } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { StatusBadge, StatusMaps } from "@/components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Label, Select } from "@/components/ui/Field";
import { Mensalidade } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { registrarPagamento } from "@/app/(app)/associados/actions";

export function StepFinanceiro({
  mensalidades,
  associadoId,
}: {
  mensalidades: Mensalidade[];
  associadoId?: string;
}) {
  const router = useRouter();
  const pagas = mensalidades.filter((m) => m.status === "Pago");
  const [registrando, setRegistrando] = useState<Mensalidade | null>(null);
  const [formaPagamento, setFormaPagamento] = useState("Pix");
  const [saving, setSaving] = useState(false);

  async function handleConfirmRegistrar() {
    if (!registrando || !associadoId) return;
    setSaving(true);
    await registrarPagamento(registrando.id, associadoId, { formaPagamento, valor: registrando.valor });
    setSaving(false);
    setRegistrando(null);
    router.refresh();
  }

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
                    {m.status !== "Pago" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setFormaPagamento("Pix");
                          setRegistrando(m);
                        }}
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

      <Modal open={!!registrando} onClose={() => setRegistrando(null)} size="md">
        <ModalHeader title="Registrar pagamento" onClose={() => setRegistrando(null)} />
        <ModalBody>
          {registrando && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Mensalidade de {formatDate(registrando.vencimento)} — {formatCurrency(registrando.valor)}
              </p>
              <div>
                <Label required>Forma de pagamento</Label>
                <Select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
                  <option value="Pix">Pix</option>
                  <option value="Cartão de crédito">Cartão de crédito</option>
                  <option value="Débito automático">Débito automático</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Dinheiro">Dinheiro</option>
                </Select>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setRegistrando(null)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmRegistrar} disabled={saving}>
            {saving ? "Registrando..." : "Confirmar pagamento"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
