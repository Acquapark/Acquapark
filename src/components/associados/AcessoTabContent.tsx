"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { Label, Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { AcessoAssociado } from "@/types";
import { criarAcessoAssociado, redefinirSenhaAssociado, setAcessoStatus } from "@/app/(app)/associados/acesso-actions";

export function AcessoTabContent({
  associadoId,
  acesso,
  emailSugerido,
}: {
  associadoId: string;
  acesso: AcessoAssociado | null;
  emailSugerido: string;
}) {
  const router = useRouter();
  const { pode } = useAcesso();
  const [email, setEmail] = useState(acesso?.email ?? emailSugerido);
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [redefinindo, setRedefinindo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function handleCriar() {
    if (senha !== confirmarSenha) {
      setError("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await criarAcessoAssociado(associadoId, email, senha);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSenha("");
    setConfirmarSenha("");
    setSuccessMsg("Acesso criado com sucesso.");
    router.refresh();
  }

  async function handleRedefinir() {
    if (!acesso) return;
    if (novaSenha !== confirmarNovaSenha) {
      setError("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await redefinirSenhaAssociado(associadoId, acesso.id, novaSenha);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNovaSenha("");
    setConfirmarNovaSenha("");
    setRedefinindo(false);
    setSuccessMsg("Senha redefinida com sucesso.");
  }

  async function handleToggleStatus() {
    if (!acesso) return;
    setSaving(true);
    setError("");
    const novoStatus = acesso.status === "Ativo" ? "Bloqueado" : "Ativo";
    const result = await setAcessoStatus(associadoId, novoStatus);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (!acesso && !pode("acesso_portal.criar")) {
    return <p className="text-sm text-gray-500">Este associado ainda não tem acesso ao Portal do Associado.</p>;
  }

  if (!acesso) {
    return (
      <div className="max-w-md">
        <p className="mb-1 text-sm font-medium text-gray-700">Criar acesso ao Portal do Associado</p>
        <p className="mb-4 text-xs text-gray-500">
          O associado poderá entrar em <code className="rounded bg-gray-100 px-1">/portal</code> com este e-mail e senha
          para ver e pagar suas mensalidades.
        </p>

        <div className="space-y-4">
          <div>
            <Label required>E-mail / login</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="associado@email.com" />
          </div>
          <div>
            <Label required>Senha</Label>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <Label required>Confirmar senha</Label>
            <Input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
            {error}
          </div>
        )}

        <Button className="mt-4" onClick={handleCriar} disabled={saving}>
          <KeyRound size={14} />
          {saving ? "Criando..." : "Criar acesso"}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <div className="mb-5 flex items-center justify-between rounded-[6px] border border-gray-200 p-4">
        <div>
          <p className="text-sm font-medium text-gray-800">{acesso.email}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Último acesso: {acesso.ultimoAcesso ? formatDate(acesso.ultimoAcesso) : "Nunca acessou"}
          </p>
        </div>
        <Badge tone={acesso.status === "Ativo" ? "success" : "danger"}>{acesso.status}</Badge>
      </div>

      {successMsg && (
        <div className="mb-4 rounded-[4px] border border-success-600/30 bg-success-50 px-3 py-2 text-xs text-success-700">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
          {error}
        </div>
      )}

      {pode("acesso_portal.editar") && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setRedefinindo((v) => !v)}>
            <KeyRound size={14} />
            Redefinir senha
          </Button>
          <Button variant={acesso.status === "Ativo" ? "destructive" : "secondary"} size="sm" onClick={handleToggleStatus} disabled={saving}>
            {acesso.status === "Ativo" ? <Lock size={14} /> : <Unlock size={14} />}
            {acesso.status === "Ativo" ? "Bloquear acesso" : "Desbloquear acesso"}
          </Button>
        </div>
      )}

      {redefinindo && (
        <div className="mt-4 space-y-4 rounded-[6px] border border-gray-200 bg-gray-50 p-4">
          <div>
            <Label required>Nova senha</Label>
            <Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <Label required>Confirmar nova senha</Label>
            <Input type="password" value={confirmarNovaSenha} onChange={(e) => setConfirmarNovaSenha(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRedefinindo(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleRedefinir} disabled={saving}>
              {saving ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
