"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Input, Select, Textarea } from "@/components/ui/Field";
import { CUPOM_APLICA_A_LABEL, CupomAplicaA, CupomDesconto, TipoDescontoCupom } from "@/types";
import { atualizarCupom, criarCupom } from "@/app/(app)/bilheteria/actions";

export function CupomModal({ open, onClose, cupom }: { open: boolean; onClose: () => void; cupom: CupomDesconto | null }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState(cupom?.codigo ?? "");
  const [descricao, setDescricao] = useState(cupom?.descricao ?? "");
  const [tipoDesconto, setTipoDesconto] = useState<TipoDescontoCupom>(cupom?.tipoDesconto ?? "percentual");
  const [valor, setValor] = useState(cupom ? String(cupom.valor).replace(".", ",") : "");
  const [validade, setValidade] = useState(cupom?.validade ?? "");
  const [limiteUsos, setLimiteUsos] = useState(cupom?.limiteUsos ? String(cupom.limiteUsos) : "");
  const [ativo, setAtivo] = useState(cupom?.ativo ?? true);
  const [aplicaA, setAplicaA] = useState<CupomAplicaA>(cupom?.aplicaA ?? "ingressos");
  // Mensalidades com desconto: "todas" ou só as N primeiras.
  const [todasMensalidades, setTodasMensalidades] = useState(!cupom?.mesesDesconto);
  const [mesesDesconto, setMesesDesconto] = useState(cupom?.mesesDesconto ? String(cupom.mesesDesconto) : "");
  const valePlano = aplicaA !== "ingressos";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    const input = {
      codigo,
      descricao,
      tipoDesconto,
      valor: Number(valor.replace(",", ".")),
      ativo,
      validade,
      limiteUsos,
      aplicaA,
      mesesDesconto: valePlano && !todasMensalidades ? mesesDesconto : "",
    };
    if (valePlano && !todasMensalidades && !mesesDesconto) {
      setSaving(false);
      setError("Informe em quantas mensalidades o desconto vale, ou escolha \"Todas as mensalidades\".");
      return;
    }
    const result = cupom ? await atualizarCupom(cupom.id, input) : await criarCupom(input);
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
      <ModalHeader title={cupom ? "Editar cupom" : "Novo cupom de desconto"} onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          <div>
            <Label required>Código</Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ex: VERAO10"
              className="uppercase"
            />
            <p className="mt-1 text-[11px] text-gray-400">Sem espaços. O comprador (ou o novo associado) digita este código.</p>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Para que serve este cupom" />
          </div>
          <div>
            <Label required>Vale para</Label>
            <Select value={aplicaA} onChange={(e) => setAplicaA(e.target.value as CupomAplicaA)}>
              {(Object.keys(CUPOM_APLICA_A_LABEL) as CupomAplicaA[]).map((k) => (
                <option key={k} value={k}>
                  {CUPOM_APLICA_A_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
          {valePlano && (
            <div className="rounded-[4px] border border-gray-200 bg-gray-50 p-3">
              <Label>No plano, o desconto vale em</Label>
              <div className="mt-1 space-y-2 text-sm text-gray-700">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" checked={todasMensalidades} onChange={() => setTodasMensalidades(true)} />
                  Todas as mensalidades do contrato
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" checked={!todasMensalidades} onChange={() => setTodasMensalidades(false)} />
                  Só nas primeiras
                  <Input
                    className="h-7 w-16"
                    value={mesesDesconto}
                    onChange={(e) => {
                      setMesesDesconto(e.target.value.replace(/\D/g, ""));
                      setTodasMensalidades(false);
                    }}
                    placeholder="3"
                    inputMode="numeric"
                  />
                  mensalidades
                </label>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                Valor fixo é descontado de cada mensalidade com desconto. Se uma mensalidade ficar em R$ 0,00 ela já nasce paga.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Tipo de desconto</Label>
              <Select value={tipoDesconto} onChange={(e) => setTipoDesconto(e.target.value as TipoDescontoCupom)}>
                <option value="percentual">Percentual (%)</option>
                <option value="valor_fixo">Valor fixo (R$)</option>
              </Select>
            </div>
            <div>
              <Label required>{tipoDesconto === "percentual" ? "Desconto (%)" : "Desconto (R$)"}</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tipoDesconto === "percentual" ? "10" : "20,00"} inputMode="decimal" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Validade</Label>
              <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
              <p className="mt-1 text-[11px] text-gray-400">Deixe em branco para não expirar.</p>
            </div>
            <div>
              <Label>Limite de usos</Label>
              <Input value={limiteUsos} onChange={(e) => setLimiteUsos(e.target.value.replace(/\D/g, ""))} placeholder="Sem limite" inputMode="numeric" />
              {cupom && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Já usado {cupom.usos} {cupom.usos === 1 ? "vez" : "vezes"}.
                </p>
              )}
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={ativo ? "true" : "false"} onChange={(e) => setAtivo(e.target.value === "true")}>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </Select>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</div>
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
