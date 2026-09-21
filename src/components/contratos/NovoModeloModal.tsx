"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileCheck2 } from "lucide-react";
import { Modal, ModalHeader, ModalSteps, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Input, Select, Textarea } from "@/components/ui/Field";
import { createModelo } from "@/app/(app)/contratos/actions";

const STEPS = ["Dados do Modelo", "Modelo do Contrato"];

export function NovoModeloModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("Associação");
  const [status, setStatus] = useState("Ativo");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    setStep(0);
    setNome("");
    setDescricao("");
    setTipo("Associação");
    setStatus("Ativo");
    setFile(null);
    setError("");
    onClose();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  async function handleCreate() {
    if (!nome) {
      setStep(0);
      setError("Preencha o nome do modelo.");
      return;
    }
    setSaving(true);
    setError("");

    const formData = new FormData();
    formData.set("nome", nome);
    formData.set("descricao", descricao);
    formData.set("tipo", tipo);
    formData.set("status", status);
    if (file) formData.set("arquivo", file);

    const result = await createModelo(formData);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    handleClose();
    router.push(`/contratos/modelos/${result.modeloId}`);
  }

  return (
    <Modal open={open} onClose={handleClose} size="lg">
      <ModalHeader title="Novo Modelo" subtitle={`Etapa ${step + 1} de ${STEPS.length} — ${STEPS[step]}`} onClose={handleClose} />
      <ModalSteps steps={STEPS} activeIndex={step} onStepClick={setStep} />

      <ModalBody>
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label required>Nome do modelo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Contrato de Associação Aqua Park" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Uso e observações sobre este modelo" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Tipo de contrato</Label>
                <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="Associação">Associação</option>
                  <option value="Familiar">Familiar</option>
                  <option value="Corporativo">Corporativo</option>
                  <option value="Outro">Outro</option>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center gap-3 rounded-[6px] border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center hover:border-primary-400"
            >
              {file ? (
                <>
                  <FileCheck2 size={28} className="text-success-600" />
                  <p className="text-sm font-medium text-gray-700">{file.name}</p>
                  <Button variant="secondary" size="sm" onClick={() => setFile(null)}>
                    Remover arquivo
                  </Button>
                </>
              ) : (
                <>
                  <Upload size={28} className="text-gray-400" />
                  <p className="text-sm text-gray-600">Arraste o contrato aqui, ou</p>
                  <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Selecionar arquivo
                  </Button>
                  <p className="text-xs text-gray-400">Formatos: .docx</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <p className="mt-3 text-xs text-gray-400">
              O conteúdo do arquivo será convertido para o editor do sistema, onde você poderá inserir variáveis e ajustar o
              texto. Você também pode pular esta etapa e começar em branco.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
            {error}
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
          {step === 0 && <Button onClick={() => setStep(1)}>Próximo</Button>}
          {step === 1 && (
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Criando..." : "Criar modelo"}
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
}
