"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { GrupoModal } from "@/components/configuracoes/GrupoModal";
import { GrupoAcesso } from "@/lib/supabase/usuarios-grupos";
import { TODAS_PERMISSOES } from "@/lib/permissoes";
import { duplicarGrupo, excluirGrupo } from "@/app/(app)/configuracoes/acesso-actions";

export function GruposSection({ grupos }: { grupos: GrupoAcesso[] }) {
  const router = useRouter();
  const { pode } = useAcesso();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GrupoAcesso | null>(null);
  const [excluindo, setExcluindo] = useState<GrupoAcesso | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  function abrir(grupo: GrupoAcesso | null) {
    setEditing(grupo);
    setModalOpen(true);
  }

  async function duplicar(g: GrupoAcesso) {
    setBusy(true);
    setErro("");
    const result = await duplicarGrupo(g.id);
    setBusy(false);
    if ("error" in result) setErro(result.error);
    else router.refresh();
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setBusy(true);
    setErro("");
    const result = await excluirGrupo(excluindo.id);
    setBusy(false);
    if ("error" in result) setErro(result.error);
    setExcluindo(null);
    if (!("error" in result)) router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Grupos e Permissões</h2>
          <p className="text-xs text-gray-500">
            Crie grupos e defina, para cada área do sistema, quem pode visualizar, criar, editar e excluir.
          </p>
        </div>
        {pode("grupos.criar") && (
          <Button size="sm" onClick={() => abrir(null)}>
            <Plus size={14} />
            Novo Grupo
          </Button>
        )}
      </div>

      {erro && (
        <div className="mb-3 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{erro}</div>
      )}

      <Table className="rounded-[6px] border border-gray-200">
        <Thead>
          <tr>
            <Th>Grupo</Th>
            <Th>Descrição</Th>
            <Th>Usuários</Th>
            <Th>Permissões</Th>
            <Th>Ações</Th>
          </tr>
        </Thead>
        <Tbody>
          {grupos.length === 0 && <TableEmpty colSpan={5} message="Nenhum grupo cadastrado." />}
          {grupos.map((g) => (
            <Tr key={g.id}>
              <Td className="font-medium text-gray-800">
                <span className="flex items-center gap-2">
                  {g.nome}
                  {g.acessoTotal && (
                    <Badge tone="info" dot={false}>
                      <Lock size={10} className="mr-1" />
                      Acesso total
                    </Badge>
                  )}
                </span>
              </Td>
              <Td className="min-w-44 max-w-sm whitespace-normal text-gray-500">{g.descricao || "—"}</Td>
              <Td>{g.totalUsuarios}</Td>
              <Td>{g.acessoTotal ? "Todas" : `${g.permissoes.length} de ${TODAS_PERMISSOES.length}`}</Td>
              <Td>
                <div className="flex gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => abrir(g)}>
                    {pode("grupos.editar") ? "Editar" : "Ver"}
                  </Button>
                  {pode("grupos.criar") && !g.acessoTotal && (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => duplicar(g)}>
                      Duplicar
                    </Button>
                  )}
                  {pode("grupos.excluir") && !g.acessoTotal && (
                    <Button variant="ghost" size="sm" onClick={() => setExcluindo(g)}>
                      Excluir
                    </Button>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <GrupoModal key={editing?.id ?? "novo"} open={modalOpen} onClose={() => setModalOpen(false)} grupo={editing} />

      <Modal open={!!excluindo} onClose={() => setExcluindo(null)} size="md">
        <ModalHeader title="Excluir grupo" onClose={() => setExcluindo(null)} />
        <ModalBody>
          <p className="text-sm text-gray-600">
            Excluir o grupo <strong>{excluindo?.nome}</strong>? Só é possível se nenhum usuário estiver nele.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setExcluindo(null)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmarExclusao} disabled={busy}>
            {busy ? "Excluindo..." : "Excluir"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
