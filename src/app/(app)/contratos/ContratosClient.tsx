"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { RowMenu } from "@/components/ui/RowMenu";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";
import { ModeloContrato } from "@/lib/supabase/contratos";
import { NovoModeloModal } from "@/components/contratos/NovoModeloModal";
import { VariaveisTab } from "@/components/contratos/VariaveisTab";
import { deleteModelo, duplicateModelo, toggleModeloStatus } from "./actions";

export function ContratosClient({ modelos }: { modelos: ModeloContrato[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"modelos" | "variaveis">("modelos");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<ModeloContrato | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  async function handleToggleStatus(m: ModeloContrato) {
    await toggleModeloStatus(m.id, m.status === "Ativo" ? "Inativo" : "Ativo");
    router.refresh();
  }

  async function handleDuplicate(id: string) {
    const result = await duplicateModelo(id);
    if (result.modeloId) router.push(`/contratos/modelos/${result.modeloId}`);
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    await deleteModelo(deleting.id);
    setDeletingBusy(false);
    setDeleting(null);
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Contratos"
        subtitle="Gerencie modelos e contratos dos associados."
        action={
          tab === "modelos" ? (
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={16} />
              Novo Modelo
            </Button>
          ) : undefined
        }
      />

      <Card>
        <div className="px-4">
          <Tabs
            tabs={[
              { key: "modelos", label: "Modelos de contrato" },
              { key: "variaveis", label: "Variáveis" },
            ]}
            active={tab}
            onChange={(k) => setTab(k as "modelos" | "variaveis")}
          />
        </div>

        {tab === "modelos" ? (
          <Table>
            <Thead>
              <tr>
                <Th>Modelo</Th>
                <Th>Tipo</Th>
                <Th>Versão</Th>
                <Th>Status</Th>
                <Th>Atualizado em</Th>
                <Th className="w-10" />
              </tr>
            </Thead>
            <Tbody>
              {modelos.length === 0 && (
                <TableEmpty colSpan={6} message="Nenhum modelo cadastrado ainda. Clique em “Novo Modelo” para começar." />
              )}
              {modelos.map((m) => (
                <Tr key={m.id} onClick={() => router.push(`/contratos/modelos/${m.id}`)}>
                  <Td>
                    <p className="font-medium text-gray-800">{m.nome}</p>
                    {m.descricao && <p className="text-xs text-gray-500">{m.descricao}</p>}
                  </Td>
                  <Td>{m.tipo}</Td>
                  <Td>{m.versao.toFixed(1)}</Td>
                  <Td>
                    <Badge tone={m.status === "Ativo" ? "success" : "neutral"}>{m.status}</Badge>
                  </Td>
                  <Td>{formatDate(m.updatedAt)}</Td>
                  <Td>
                    <div onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        items={[
                          { label: "Editar", onClick: () => router.push(`/contratos/modelos/${m.id}`) },
                          { label: "Visualizar", onClick: () => router.push(`/contratos/modelos/${m.id}?preview=1`) },
                          { label: "Duplicar", onClick: () => handleDuplicate(m.id) },
                          { label: m.status === "Ativo" ? "Inativar" : "Ativar", onClick: () => handleToggleStatus(m) },
                          { label: "Excluir", onClick: () => setDeleting(m), destructive: true },
                        ]}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <div className="p-5">
            <VariaveisTab />
          </div>
        )}
      </Card>

      <NovoModeloModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <Modal open={!!deleting} onClose={() => setDeleting(null)} size="md">
        <ModalHeader title="Excluir modelo" onClose={() => setDeleting(null)} />
        <ModalBody>
          <p className="text-sm text-gray-700">
            Excluir o modelo <span className="font-medium">&ldquo;{deleting?.nome}&rdquo;</span>? Essa ação não pode ser
            desfeita. Contratos já gerados a partir dele não são afetados.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirmDelete} disabled={deletingBusy}>
            {deletingBusy ? "Excluindo..." : "Excluir"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
