"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Input, Select, Textarea } from "@/components/ui/Field";
import { RegraReentrada, TipoIngresso } from "@/types";
import { createTipoIngresso, updateTipoIngresso } from "@/app/(app)/bilheteria/actions";

export const REGRA_REENTRADA_LABEL: Record<RegraReentrada, string> = {
  unica: "Entrada única",
  reentrada: "Permite reentrada",
  ilimitado: "Acesso ilimitado no dia",
};

export function TipoIngressoModal({
  open,
  onClose,
  tipo,
}: {
  open: boolean;
  onClose: () => void;
  tipo: TipoIngresso | null;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(tipo?.nome ?? "");
  const [descricao, setDescricao] = useState(tipo?.descricao ?? "");
  const [valor, setValor] = useState(tipo ? tipo.valor.toFixed(2) : "");
  const [validade, setValidade] = useState(tipo?.validade ?? "1 dia");
  const [regraReentrada, setRegraReentrada] = useState<RegraReentrada>(tipo?.regraReentrada ?? "unica");
  const [ativo, setAtivo] = useState(tipo?.ativo ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    const input = {
      nome,
      descricao,
      valor: Number(valor.replace(",", ".")),
      validade,
      regraReentrada,
      ativo,
    };
    const result = tipo ? await updateTipoIngresso(tipo.id, input) : await createTipoIngresso(input);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader title={tipo ? "Editar tipo de ingresso" : "Novo tipo de ingresso"} onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          <div>
            <Label required>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Diária Adulto" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Quem pode usar, condições..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Valor</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <Label>Validade</Label>
              <Input value={validade} onChange={(e) => setValidade(e.target.value)} placeholder="1 dia" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Regra de entrada</Label>
              <Select value={regraReentrada} onChange={(e) => setRegraReentrada(e.target.value as RegraReentrada)}>
                {(Object.keys(REGRA_REENTRADA_LABEL) as RegraReentrada[]).map((k) => (
                  <option key={k} value={k}>
                    {REGRA_REENTRADA_LABEL[k]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={ativo ? "true" : "false"} onChange={(e) => setAtivo(e.target.value === "true")}>
                <option value="true">Ativo (à venda)</option>
                <option value="false">Inativo</option>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-gray-400">
            A regra de entrada é copiada para cada ingresso vendido. Alterar depois não muda ingressos já emitidos.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
            {error}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
