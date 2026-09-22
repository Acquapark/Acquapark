"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CupomDesconto } from "@/types";
import { excluirCupom, setCupomAtivo } from "@/app/(app)/bilheteria/actions";
import { CupomModal } from "./CupomModal";

function formatarDesconto(c: CupomDesconto) {
  return c.tipoDesconto === "percentual" ? `${c.valor}%` : formatCurrency(c.valor);
}

export function CupomManager({ cupons }: { cupons: CupomDesconto[] }) {
  const router = useRouter();
  const { pode } = useAcesso();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CupomDesconto | null>(null);
  const [modalKey, setModalKey] = useState(0);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<CupomDesconto | null>(null);
  const [excluindoBusy, setExcluindoBusy] = useState(false);
  const [error, setError] = useState("");

  function openNew() {
    setEditing(null);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  }

  function openEdit(c: CupomDesconto) {
    setEditing(c);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  }

  async function handleToggle(c: CupomDesconto) {
    setTogglingId(c.id);
    setError("");
    const result = await setCupomAtivo(c.id, !c.ativo);
    setTogglingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleConfirmarExclusao() {
    if (!excluindo) return;
    setExcluindoBusy(true);
    setError("");
    const result = await excluirCupom(excluindo.id);
    setExcluindoBusy(false);
    if (result.error) {
      setError(result.error);
      setExcluindo(null);
      return;
    }
    setExcluindo(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Cupons de Desconto</h2>
          <p className="text-xs text-gray-500">Códigos que a equipe pode aplicar na venda de ingressos avulsos.</p>
        </div>
        {pode("cupons_desconto.criar") && (
          <Button size="sm" onClick={openNew}>
            <Plus size={14} />
            Novo Cupom
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</div>
      )}

      <Table className="rounded-[6px] border border-gray-200">
        <Thead>
          <tr>
            <Th>Código</Th>
            <Th>Descrição</Th>
            <Th>Desconto</Th>
            <Th>Validade</Th>
            <Th>Usos</Th>
            <Th>Status</Th>
            <Th>Ações</Th>
          </tr>
        </Thead>
        <Tbody>
          {cupons.length === 0 && <TableEmpty colSpan={7} message="Nenhum cupom cadastrado." />}
          {cupons.map((c) => (
            <Tr key={c.id}>
              <Td className="font-medium text-gray-800">{c.codigo}</Td>
              <Td className="max-w-xs whitespace-normal text-gray-500">{c.descricao || "—"}</Td>
              <Td>{formatarDesconto(c)}</Td>
              <Td>{c.validade ? formatDate(c.validade) : "Sem validade"}</Td>
              <Td>
                {c.usos}
                {c.limiteUsos ? ` / ${c.limiteUsos}` : ""}
              </Td>
              <Td>
                <Badge tone={c.ativo ? "success" : "neutral"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
              </Td>
              <Td>
                {pode("cupons_desconto.editar") && (
                  <div className="flex gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(c)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(c)} disabled={togglingId === c.id}>
                      {c.ativo ? "Desativar" : "Ativar"}
                    </Button>
                    {pode("cupons_desconto.excluir") && (
                      <Button variant="ghost" size="sm" onClick={() => setExcluindo(c)}>
                        Excluir
                      </Button>
                    )}
                  </div>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <CupomModal key={modalKey} open={modalOpen} onClose={() => setModalOpen(false)} cupom={editing} />

      <Modal open={!!excluindo} onClose={() => setExcluindo(null)} size="md">
        <ModalHeader title="Excluir cupom" onClose={() => setExcluindo(null)} />
        <ModalBody>
          <p className="text-sm text-gray-600">
            Excluir <strong>{excluindo?.codigo}</strong>? Só é possível se ele nunca tiver sido usado em uma venda — se já foi
            usado, desative-o em vez de excluir.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setExcluindo(null)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirmarExclusao} disabled={excluindoBusy}>
            {excluindoBusy ? "Excluindo..." : "Excluir"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
