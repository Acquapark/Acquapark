"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ban, IdCard, Pencil, RotateCcw, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { StatusBadge, StatusMaps } from "@/components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { AssociadoFormState, emptyAssociadoForm } from "@/components/associados/form-types";
import { StepDadosBasicos } from "@/components/associados/steps/StepDadosBasicos";
import { ProfileDependentesTab } from "@/components/associados/ProfileDependentesTab";
import { ProfilePlanoTab } from "@/components/associados/ProfilePlanoTab";
import { StepFinanceiro } from "@/components/associados/steps/StepFinanceiro";
import { StepAcessos } from "@/components/associados/steps/StepAcessos";
import { StepCredencial } from "@/components/associados/steps/StepCredencial";
import { ContratosTabContent } from "@/components/associados/ContratosTabContent";
import { AcessoTabContent } from "@/components/associados/AcessoTabContent";
import { Associado, AcessoAssociado, AssociadoStatus, Contrato, Plano } from "@/types";
import { ContratoGerado, ModeloContrato } from "@/lib/supabase/contratos";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { ensureCredencial, regenerarCredencial, updateAssociado, updateAssociadoStatus } from "@/app/(app)/associados/actions";

const TAB_KEYS = ["dados", "plano", "dependentes", "contrato", "financeiro", "acessos", "credencial", "acesso"] as const;
const TAB_LABELS: Record<(typeof TAB_KEYS)[number], string> = {
  dados: "Dados Básicos",
  plano: "Plano",
  dependentes: "Dependentes",
  contrato: "Contrato",
  financeiro: "Financeiro",
  acessos: "Acessos",
  credencial: "Credencial",
  acesso: "Acesso",
};

/** Permissão que libera cada aba do perfil. */
const TAB_PERMISSOES: Record<(typeof TAB_KEYS)[number], string> = {
  dados: "associados.visualizar",
  plano: "planos_associado.visualizar",
  dependentes: "dependentes.visualizar",
  contrato: "contratos_gerados.visualizar",
  financeiro: "contas_receber.visualizar",
  acessos: "associados.visualizar",
  credencial: "credenciais.visualizar",
  acesso: "acesso_portal.visualizar",
};

function buildForm(associado: Associado, planoId: string | null): AssociadoFormState {
  return {
    ...emptyAssociadoForm,
    nome: associado.nome,
    cpf: associado.cpf,
    rg: associado.rg ?? "",
    nascimento: associado.nascimento ?? "",
    email: associado.email,
    telefone: associado.telefone,
    cep: associado.cep ?? "",
    endereco: associado.endereco ?? "",
    numero: associado.numeroEndereco ?? "",
    bairro: associado.bairro ?? "",
    cidade: associado.cidade ?? "",
    estado: associado.estado ?? "",
    planoId: planoId ?? "",
    dependentes: associado.dependentes,
    valorMensalidade: String(associado.mensalidade.toFixed(2)),
  };
}

type StatusAction = { label: string; icon: typeof Ban; target: AssociadoStatus; variant: "secondary" | "destructive" };

function statusActionsFor(status: AssociadoStatus): StatusAction[] {
  switch (status) {
    case "Suspenso":
      return [
        { label: "Reativar", icon: RotateCcw, target: "Ativo", variant: "secondary" },
        { label: "Inativar", icon: UserX, target: "Inativo", variant: "destructive" },
      ];
    case "Inativo":
      return [{ label: "Reativar", icon: RotateCcw, target: "Ativo", variant: "secondary" }];
    default:
      return [
        { label: "Bloquear", icon: Ban, target: "Suspenso", variant: "secondary" },
        { label: "Inativar", icon: UserX, target: "Inativo", variant: "destructive" },
      ];
  }
}

export function AssociadoProfileClient({
  associado,
  planoId,
  credencialCodigo,
  planos,
  contratosGerados,
  modelosAtivos,
  acesso,
  contratoAtivo,
}: {
  associado: Associado;
  planoId: string | null;
  credencialCodigo: string | null;
  planos: Plano[];
  contratosGerados: ContratoGerado[];
  modelosAtivos: ModeloContrato[];
  acesso: AcessoAssociado | null;
  contratoAtivo: Contrato | null;
}) {
  const router = useRouter();
  const { pode } = useAcesso();
  const [activeTab, setActiveTab] = useState<(typeof TAB_KEYS)[number]>("dados");
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<AssociadoFormState>(() => buildForm(associado, planoId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [codigo, setCodigo] = useState(credencialCodigo);
  const [statusPending, setStatusPending] = useState<StatusAction | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusResultMsg, setStatusResultMsg] = useState<{ tone: "success" | "warning"; texto: string } | null>(null);

  const planoAtual = planos.find((p) => p.id === planoId) ?? null;

  useEffect(() => {
    if (activeTab === "credencial" && !codigo) {
      ensureCredencial(associado.id).then((result) => {
        if (result.codigo) setCodigo(result.codigo);
      });
    }
  }, [activeTab, codigo, associado.id]);

  function update(patch: Partial<AssociadoFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleStartEdit() {
    setForm(buildForm(associado, planoId));
    setError("");
    setEditMode(true);
    setActiveTab("dados");
  }

  function handleCancelEdit() {
    setForm(buildForm(associado, planoId));
    setError("");
    setEditMode(false);
  }

  async function handleSave() {
    if (!form.nome || !form.cpf) {
      setError("Nome e CPF são obrigatórios.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await updateAssociado(associado.id, form);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditMode(false);
    router.refresh();
  }

  async function handleRegenerateCredencial() {
    const result = await regenerarCredencial(associado.id);
    if (result.codigo) setCodigo(result.codigo);
  }

  async function handleConfirmStatus() {
    if (!statusPending) return;
    setStatusSaving(true);
    const result = await updateAssociadoStatus(associado.id, statusPending.target);
    setStatusSaving(false);
    setStatusPending(null);

    if ("error" in result) {
      setStatusResultMsg({ tone: "warning", texto: result.error });
      return;
    }
    if (result.falhasCancelamento?.length) {
      setStatusResultMsg({
        tone: "warning",
        texto: `Associado inativado, mas ${result.falhasCancelamento.length} parcela(s) não puderam ser canceladas na Asaas automaticamente — cancele manualmente pelo Financeiro: ${result.falhasCancelamento.join("; ")}`,
      });
    } else if (result.parcelasCanceladas) {
      setStatusResultMsg({
        tone: "success",
        texto: `Associado inativado. ${result.parcelasCanceladas} parcela(s) em aberto foram canceladas na Asaas e o contrato foi encerrado.`,
      });
    } else {
      setStatusResultMsg(null);
    }
    router.refresh();
  }

  const situacaoFinanceira = associado.mensalidades.some((m) => m.status === "Vencido")
    ? "Inadimplente"
    : associado.mensalidades.some((m) => m.status === "Pendente")
      ? "Pendente"
      : "Em dia";

  return (
    <div>
      <Link href="/associados" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} />
        Voltar para Associados
      </Link>

      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-lg font-semibold text-primary-700">
              {associado.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-gray-900">{associado.nome}</h1>
                <StatusBadge status={associado.status} map={StatusMaps.associado} />
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                Nº {associado.numero} · Plano {associado.plano} · Situação financeira:{" "}
                <span
                  className={
                    situacaoFinanceira === "Em dia"
                      ? "font-medium text-success-700"
                      : situacaoFinanceira === "Pendente"
                        ? "font-medium text-warning-700"
                        : "font-medium text-danger-700"
                  }
                >
                  {situacaoFinanceira}
                </span>
              </p>
            </div>
          </div>

          {editMode ? (
            <div className="flex items-center gap-3">
              {error && <span className="text-xs font-medium text-danger-600">{error}</span>}
              <Button variant="secondary" size="sm" onClick={handleCancelEdit} disabled={saving}>
                <X size={14} />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              {pode("associados.editar") && (
                <Button variant="secondary" size="sm" onClick={handleStartEdit}>
                  <Pencil size={14} />
                  Editar
                </Button>
              )}
              {pode("associados.alterar_status") &&
                statusActionsFor(associado.status).map((action) => (
                  <Button key={action.label} variant={action.variant} size="sm" onClick={() => setStatusPending(action)}>
                    <action.icon size={14} />
                    {action.label}
                  </Button>
                ))}
              {pode("credenciais.visualizar") && (
                <Button size="sm" onClick={() => setActiveTab("credencial")}>
                  <IdCard size={14} />
                  Gerar credencial
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {statusResultMsg && (
        <div
          className={`mb-5 rounded-[4px] border px-3 py-2 text-xs font-medium ${
            statusResultMsg.tone === "success"
              ? "border-success-600/30 bg-success-50 text-success-700"
              : "border-warning-600/30 bg-warning-50 text-warning-700"
          }`}
        >
          {statusResultMsg.texto}
        </div>
      )}

      <Card>
        <div className="px-4">
          <Tabs
            tabs={TAB_KEYS.filter((key) => pode(TAB_PERMISSOES[key])).map((key) => ({ key, label: TAB_LABELS[key] }))}
            active={activeTab}
            onChange={(key) => setActiveTab(key as (typeof TAB_KEYS)[number])}
          />
        </div>
        <div className="p-5">
          {activeTab === "dados" && <StepDadosBasicos form={form} update={update} disabled={!editMode} />}
          {activeTab === "dependentes" && (
            <ProfileDependentesTab associadoId={associado.id} dependentes={associado.dependentes} plano={planoAtual} />
          )}
          {activeTab === "plano" && (
            <ProfilePlanoTab associadoId={associado.id} contratoAtivo={contratoAtivo} planos={planos} />
          )}
          {activeTab === "contrato" && (
            <ContratosTabContent
              associado={associado}
              contratos={contratosGerados}
              modelos={modelosAtivos}
              onEditAssociado={handleStartEdit}
            />
          )}
          {activeTab === "financeiro" && <StepFinanceiro mensalidades={associado.mensalidades} associadoId={associado.id} />}
          {activeTab === "acessos" && <StepAcessos acessos={associado.acessos} />}
          {activeTab === "credencial" && (
            <StepCredencial
              form={form}
              numero={associado.numero}
              planos={planos}
              codigo={codigo}
              onRegenerate={pode("credenciais.editar") ? handleRegenerateCredencial : undefined}
            />
          )}
          {activeTab === "acesso" && (
            <AcessoTabContent associadoId={associado.id} acesso={acesso} emailSugerido={associado.email} />
          )}
        </div>
      </Card>

      <Modal open={!!statusPending} onClose={() => setStatusPending(null)} size="md">
        <ModalHeader title={`${statusPending?.label} associado`} onClose={() => setStatusPending(null)} />
        <ModalBody>
          <p className="text-sm text-gray-700">
            {statusPending?.target === "Ativo"
              ? `Reativar "${associado.nome}"? O status voltará para Ativo e o acesso ao parque será liberado novamente.`
              : statusPending?.target === "Suspenso"
                ? `Bloquear "${associado.nome}"? O status muda para Suspenso e o acesso ao parque passa a ser negado até a reativação.`
                : `Inativar "${associado.nome}"? O status muda para Inativo, o contrato é encerrado e todas as mensalidades ainda em aberto são canceladas (inclusive na Asaas, pra não continuar cobrando). Use esta opção para encerramentos definitivos.`}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setStatusPending(null)} disabled={statusSaving}>
            Cancelar
          </Button>
          <Button
            variant={statusPending?.variant === "destructive" ? "destructive" : "primary"}
            onClick={handleConfirmStatus}
            disabled={statusSaving}
          >
            {statusSaving ? "Aplicando..." : `Confirmar ${statusPending?.label.toLowerCase()}`}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
