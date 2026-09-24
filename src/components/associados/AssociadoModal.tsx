"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalSteps, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AssociadoFormState, emptyAssociadoForm, STEPS } from "./form-types";
import { StepDadosBasicos } from "./steps/StepDadosBasicos";
import { StepDependentes } from "./steps/StepDependentes";
import { StepPlano } from "./steps/StepPlano";
import { StepContrato } from "./steps/StepContrato";
import { StepFinanceiro } from "./steps/StepFinanceiro";
import { StepAcessos } from "./steps/StepAcessos";
import { StepCredencial } from "./steps/StepCredencial";
import { Plano } from "@/types";
import { createAssociado, regenerarCredencial } from "@/app/(app)/associados/actions";

export function AssociadoModal({
  open,
  onClose,
  planos,
}: {
  open: boolean;
  onClose: () => void;
  planos: Plano[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<AssociadoFormState>(emptyAssociadoForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedNumero, setSavedNumero] = useState<string | null>(null);
  const [savedAssociadoId, setSavedAssociadoId] = useState<string | null>(null);
  const [credencialCodigo, setCredencialCodigo] = useState<string | null>(null);

  function update(patch: Partial<AssociadoFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleClose() {
    setStep(0);
    setForm(emptyAssociadoForm);
    setError("");
    setSavedNumero(null);
    setSavedAssociadoId(null);
    setCredencialCodigo(null);
    onClose();
  }

  async function handleSave(): Promise<boolean> {
    if (!form.nome || !form.cpf) {
      setError("Preencha ao menos nome e CPF antes de salvar.");
      return false;
    }
    if (!form.email) {
      setError("Informe o e-mail do associado — é para onde vai o contrato para assinatura.");
      return false;
    }
    setSaving(true);
    setError("");
    const result = await createAssociado(form);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setSavedNumero(result.numero ?? null);
    setSavedAssociadoId(result.associadoId ?? null);
    setCredencialCodigo(result.credencialCodigo ?? null);
    router.refresh();
    return true;
  }

  async function handleRegenerateCredencial() {
    if (!savedAssociadoId) return;
    const result = await regenerarCredencial(savedAssociadoId);
    if (result.codigo) setCredencialCodigo(result.codigo);
  }

  async function handleConcluir() {
    // Se o funcionário nunca clicou em "Salvar" em nenhuma etapa, "Concluir"
    // salva agora — sem isso, o cadastro inteiro era descartado ao fechar o
    // modal (só existia no estado do formulário, nunca chegava ao banco).
    if (!savedNumero) {
      const salvou = await handleSave();
      if (!salvou) return;
    }
    handleClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={handleClose} size="xl">
      <ModalHeader title="Novo Associado" subtitle={`Etapa ${step + 1} de ${STEPS.length} — ${STEPS[step]}`} onClose={handleClose} />
      <ModalSteps steps={STEPS} activeIndex={step} onStepClick={setStep} />

      <ModalBody>
        {step === 0 && <StepDadosBasicos form={form} update={update} />}
        {step === 1 && <StepPlano form={form} update={update} planos={planos} />}
        {step === 2 && <StepDependentes form={form} update={update} planos={planos} />}
        {step === 3 && <StepContrato form={form} update={update} planos={planos} />}
        {step === 4 && <StepFinanceiro mensalidades={[]} />}
        {step === 5 && <StepAcessos acessos={[]} />}
        {step === 6 && (
          <StepCredencial
            form={form}
            numero={savedNumero ?? undefined}
            planos={planos}
            codigo={credencialCodigo}
            onRegenerate={savedAssociadoId ? handleRegenerateCredencial : undefined}
          />
        )}

        {error && (
          <div className="mt-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
            {error}
          </div>
        )}
        {savedNumero && (
          <div className="mt-4 rounded-[4px] border border-success-600/30 bg-success-50 px-3 py-2 text-xs text-success-700">
            Associado salvo com sucesso — número {savedNumero}. Você pode continuar preenchendo as próximas etapas.
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={handleClose}>
          Cancelar
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={handleSave} disabled={saving || !!savedNumero}>
            {saving ? "Salvando..." : savedNumero ? "Salvo" : "Salvar"}
          </Button>
          {step < STEPS.length - 1 && <Button onClick={() => setStep((s) => s + 1)}>Próximo</Button>}
          {step === STEPS.length - 1 && (
            <Button onClick={handleConcluir} disabled={saving}>
              {saving ? "Salvando..." : "Concluir"}
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
}
