"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Label, Input } from "@/components/ui/Field";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { UsuarioModal } from "@/components/configuracoes/UsuarioModal";
import { GrupoAcesso, UsuarioEquipe } from "@/lib/supabase/usuarios-grupos";
import {
  atualizarUsuario,
  excluirUsuario,
  redefinirSenhaUsuario,
} from "@/app/(app)/configuracoes/acesso-actions";

export function UsuariosSection({ usuarios, grupos }: { usuarios: UsuarioEquipe[]; grupos: GrupoAcesso[] }) {
  const router = useRouter();
  const { acesso, pode } = useAcesso();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UsuarioEquipe | null>(null);
  const [senhaDe, setSenhaDe] = useState<UsuarioEquipe | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [excluindo, setExcluindo] = useState<UsuarioEquipe | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  async function alternarAtivo(u: UsuarioEquipe) {
    setBusy(true);
    setErro("");
    const result = await atualizarUsuario(u.id, { nome: u.nome, grupoId: u.grupoId ?? "", ativo: !u.ativo });
    setBusy(false);
    if ("error" in result) setErro(result.error);
    else router.refresh();
  }

  async function confirmarSenha() {
    if (!senhaDe) return;
    setBusy(true);
    setErro("");
    const result = await redefinirSenhaUsuario(senhaDe.id, novaSenha);
    setBusy(false);
    if ("error" in result) {
      setErro(result.error);
      return;
    }
    setSenhaDe(null);
    setNovaSenha("");
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setBusy(true);
    setErro("");
    const result = await excluirUsuario(excluindo.id);
    setBusy(false);
    if ("error" in result) {
      setErro(result.error);
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
          <h2 className="text-sm font-semibold text-gray-800">Usuários</h2>
          <p className="text-xs text-gray-500">Pessoas da equipe que acessam o painel. O que cada uma pode fazer vem do grupo.</p>
        </div>
        {pode("usuarios.criar") && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus size={14} />
            Novo Usuário
          </Button>
        )}
      </div>

      {erro && (
        <div className="mb-3 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{erro}</div>
      )}

      <Table className="rounded-[6px] border border-gray-200">
        <Thead>
          <tr>
            <Th>Nome</Th>
            <Th>E-mail</Th>
            <Th>Grupo</Th>
            <Th>Status</Th>
            <Th>Ações</Th>
          </tr>
        </Thead>
        <Tbody>
          {usuarios.length === 0 && <TableEmpty colSpan={5} message="Nenhum usuário cadastrado." />}
          {usuarios.map((u) => {
            const ehVoce = u.id === acesso.userId;
            // Só administradores mexem em outros administradores.
            const protegido = u.grupoAcessoTotal && !acesso.acessoTotal;
            return (
              <Tr key={u.id}>
                <Td className="font-medium text-gray-800">
                  {u.nome}
                  {ehVoce && <span className="ml-1.5 text-[11px] font-normal text-gray-400">(você)</span>}
                </Td>
                <Td>{u.email}</Td>
                <Td>{u.grupoNome ?? <span className="text-gray-400">Sem grupo</span>}</Td>
                <Td>
                  <Badge tone={u.ativo ? "success" : "neutral"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {pode("usuarios.editar") && !protegido && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditing(u);
                          setModalOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                    )}
                    {pode("usuarios.redefinir_senha") && !protegido && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setErro("");
                          setNovaSenha("");
                          setSenhaDe(u);
                        }}
                      >
                        Senha
                      </Button>
                    )}
                    {pode("usuarios.editar") && !protegido && !ehVoce && (
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => alternarAtivo(u)}>
                        {u.ativo ? "Inativar" : "Ativar"}
                      </Button>
                    )}
                    {pode("usuarios.excluir") && !protegido && !ehVoce && (
                      <Button variant="ghost" size="sm" onClick={() => setExcluindo(u)}>
                        Excluir
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>

      <UsuarioModal
        key={editing?.id ?? "novo"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        usuario={editing}
        grupos={grupos}
        ehVoce={editing?.id === acesso.userId}
      />

      <Modal open={!!senhaDe} onClose={() => setSenhaDe(null)} size="md">
        <ModalHeader title="Redefinir senha" subtitle={senhaDe?.nome} onClose={() => setSenhaDe(null)} />
        <ModalBody>
          <Label required>Nova senha</Label>
          <Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} autoComplete="new-password" />
          <p className="mt-1 text-[11px] text-gray-400">Mínimo de 8 caracteres. Repasse ao usuário por um canal seguro.</p>
          {erro && (
            <div className="mt-3 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{erro}</div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setSenhaDe(null)}>
            Cancelar
          </Button>
          <Button onClick={confirmarSenha} disabled={busy || novaSenha.length < 8}>
            {busy ? "Salvando..." : "Redefinir"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={!!excluindo} onClose={() => setExcluindo(null)} size="md">
        <ModalHeader title="Excluir usuário" onClose={() => setExcluindo(null)} />
        <ModalBody>
          <p className="text-sm text-gray-600">
            Excluir <strong>{excluindo?.nome}</strong> remove o acesso e o login de forma definitiva. Se o usuário tiver
            histórico (vendas, caixas), a exclusão é bloqueada — nesse caso, inative-o.
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
