"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Plano } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { PlanoModal } from "@/components/configuracoes/PlanoModal";

export function PlanosSection({ planos }: { planos: Plano[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Plano | null>(null);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: Plano) {
    setEditing(p);
    setModalOpen(true);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Planos de Associados</h2>
        <Button size="sm" onClick={openNew}>
          <Plus size={14} />
          Novo Plano
        </Button>
      </div>

      <Table className="rounded-[6px] border border-gray-200">
        <Thead>
          <tr>
            <Th>Plano</Th>
            <Th>Valor mensal</Th>
            <Th>Mensalidades</Th>
            <Th>Dia venc.</Th>
            <Th>Dependentes</Th>
            <Th>Status</Th>
            <Th>Ações</Th>
          </tr>
        </Thead>
        <Tbody>
          {planos.length === 0 && <TableEmpty colSpan={7} message="Nenhum plano cadastrado." />}
          {planos.map((p) => (
            <Tr key={p.id}>
              <Td className="font-medium text-gray-800">{p.nome}</Td>
              <Td>{formatCurrency(p.valor)}</Td>
              <Td>{p.quantidadeMensalidades}x</Td>
              <Td>{p.vencimentoNaContratacao ? "Data da contratação" : `Dia ${p.diaVencimento}`}</Td>
              <Td>{p.dependentesPermitidos}</Td>
              <Td>
                <Badge tone={p.ativo ? "success" : "neutral"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
              </Td>
              <Td>
                <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>
                  Editar
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <PlanoModal key={editing?.id ?? "new"} open={modalOpen} onClose={() => setModalOpen(false)} plano={editing} />
    </div>
  );
}
