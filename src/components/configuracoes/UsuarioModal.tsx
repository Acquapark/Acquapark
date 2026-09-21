"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Input, Select } from "@/components/ui/Field";
import { GrupoAcesso, UsuarioEquipe } from "@/lib/supabase/usuarios-grupos";
import { atualizarUsuario, criarUsuario } from "@/app/(app)/configuracoes/acesso-actions";

export function UsuarioModal({
  open,
  onClose,
  usuario,
  grupos,
  ehVoce,
}: {
  open: boolean;
  onClose: () => void;
  /** null = novo usuário */
  usuario: UsuarioEquipe | null;
  grupos: GrupoAcesso[];
  ehVoce: boolean;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [senha, setSenha] = useState("");
  const [grupoId, setGrupoId] = useState(usuario?.grupoId ?? "");
  const [ativo, setAtivo] = useState(usuario?.ativo ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (nome.trim().length < 2 || !grupoId || (!usuario && (!email || senha.length < 8))) {
      setError(
        !usuario && senha.length < 8 && nome && email && grupoId
          ? "A senha deve ter pelo menos 8 caracteres."
          : "Preencha nome, e-mail, senha e grupo.",
      );
      return;
    }
    setSaving(true);
    setError("");
    const result = usuario
      ? await atualizarUsuario(usuario.id, { nome, grupoId, ativo })
      : await criarUsuario({ nome, email, senha, grupoId });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader
        title={usuario ? "Editar usuário" : "Novo usuário"}
        subtitle={usuario ? undefined : "O usuário entra no painel com este e-mail e senha."}
        onClose={onClose}
      />
      <ModalBody>
        <div className="space-y-4">
          <div>
            <Label required>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <Label required>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              disabled={!!usuario}
            />
          </div>
          {!usuario && (
            <div>
              <Label required>Senha inicial</Label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
              <p className="mt-1 text-[11px] text-gray-400">Mínimo de 8 caracteres. Repasse ao usuário por um canal seguro.</p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label required>Grupo de acesso</Label>
              <Select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                <option value="">Selecione</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </Select>
            </div>
            {usuario && (
              <div>
                <Label>Status</Label>
                <Select value={ativo ? "true" : "false"} onChange={(e) => setAtivo(e.target.value === "true")} disabled={ehVoce}>
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </Select>
                {ehVoce && <p className="mt-1 text-[11px] text-gray-400">Você não pode inativar o próprio usuário.</p>}
              </div>
            )}
          </div>
          {usuario && !ativo && (
            <p className="text-xs text-gray-500">Usuários inativos não conseguem entrar no painel; o histórico deles é mantido.</p>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
