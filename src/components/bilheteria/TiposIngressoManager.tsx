"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { formatCurrency } from "@/lib/utils";
import { TipoIngresso } from "@/types";
import { setTipoIngressoAtivo } from "@/app/(app)/bilheteria/actions";
import { REGRA_REENTRADA_LABEL, TipoIngressoModal } from "./TipoIngressoModal";

export function TiposIngressoManager({ tipos, title }: { tipos: TipoIngresso[]; title?: string }) {
  const router = useRouter();
  const { pode } = useAcesso();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TipoIngresso | null>(null);
  const [modalKey, setModalKey] = useState(0);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function openNew() {
    setEditing(null);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  }

  function openEdit(t: TipoIngresso) {
    setEditing(t);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  }

  async function handleToggle(t: TipoIngresso) {
    setTogglingId(t.id);
    setError("");
    const result = await setTipoIngressoAtivo(t.id, !t.ativo);
    setTogglingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">{title ?? "Tipos de Ingresso"}</h2>
        {pode("tipos_ingresso.criar") && (
          <Button size="sm" onClick={openNew}>
            <Plus size={14} />
            Novo Tipo
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
          {error}
        </div>
      )}

      <Table className="rounded-[6px] border border-gray-200">
        <Thead>
          <tr>
            <Th>Nome</Th>
            <Th>Descrição</Th>
            <Th>Valor</Th>
            <Th>Validade</Th>
            <Th>Entrada</Th>
            <Th>Status</Th>
            <Th>Ações</Th>
          </tr>
        </Thead>
        <Tbody>
          {tipos.length === 0 && <TableEmpty colSpan={7} message="Nenhum tipo de ingresso cadastrado." />}
          {tipos.map((t) => (
            <Tr key={t.id}>
              <Td className="font-medium text-gray-800">{t.nome}</Td>
              <Td className="max-w-xs whitespace-normal text-gray-500">{t.descricao || "—"}</Td>
              <Td>{formatCurrency(t.valor)}</Td>
              <Td>{t.validade}</Td>
              <Td>{REGRA_REENTRADA_LABEL[t.regraReentrada]}</Td>
              <Td>
                <Badge tone={t.ativo ? "success" : "neutral"}>{t.ativo ? "Ativo" : "Inativo"}</Badge>
              </Td>
              <Td>
                {pode("tipos_ingresso.editar") && (
                  <div className="flex gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(t)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(t)} disabled={togglingId === t.id}>
                      {t.ativo ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <TipoIngressoModal key={modalKey} open={modalOpen} onClose={() => setModalOpen(false)} tipo={editing} />
    </div>
  );
}
