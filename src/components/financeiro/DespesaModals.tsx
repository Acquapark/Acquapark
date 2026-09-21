"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Input, Select, Textarea } from "@/components/ui/Field";
import { CATEGORIAS_DESPESA, FORMAS_PAGAMENTO_DESPESA } from "@/lib/financeiro-constantes";
import { formatCurrency, parseMoney } from "@/lib/utils";
import { Despesa } from "@/types";
import { createDespesa, pagarDespesa, updateDespesa } from "@/app/(app)/financeiro/actions";

function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mt-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
      {message}
    </div>
  );
}

export function DespesaModal({
  open,
  onClose,
  despesa,
  hoje,
}: {
  open: boolean;
  onClose: () => void;
  despesa: Despesa | null;
  hoje: string;
}) {
  const router = useRouter();
  const [descricao, setDescricao] = useState(despesa?.descricao ?? "");
  const [categoria, setCategoria] = useState(despesa?.categoria ?? CATEGORIAS_DESPESA[0]);
  const [fornecedor, setFornecedor] = useState(despesa?.fornecedor ?? "");
  const [valor, setValor] = useState(despesa ? despesa.valor.toFixed(2).replace(".", ",") : "");
  const [vencimento, setVencimento] = useState(despesa?.vencimento ?? hoje);
  const [observacoes, setObservacoes] = useState(despesa?.observacoes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Categoria antiga que não está mais na lista continua selecionável ao editar.
  const categorias = CATEGORIAS_DESPESA.includes(categoria) ? CATEGORIAS_DESPESA : [categoria, ...CATEGORIAS_DESPESA];

  async function handleSave() {
    const numero = parseMoney(valor);
    if (Number.isNaN(numero)) {
      setError("Informe um valor válido.");
      return;
    }
    setSaving(true);
    setError("");
    const input = { descricao, categoria, fornecedor, valor: numero, vencimento, observacoes };
    const result = despesa ? await updateDespesa(despesa.id, input) : await createDespesa(input);
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
      <ModalHeader title={despesa ? "Editar despesa" : "Nova despesa"} onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          <div>
            <Label required>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Conta de energia — setembro" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Categoria</Label>
              <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Valor</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <Label required>Vencimento</Label>
              <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>
        <ErrorBox message={error} />
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

export function PagarDespesaModal({
  despesa,
  onClose,
  hoje,
}: {
  despesa: Despesa | null;
  onClose: () => void;
  hoje: string;
}) {
  const router = useRouter();
  const [pagoEm, setPagoEm] = useState(hoje);
  const [forma, setForma] = useState(FORMAS_PAGAMENTO_DESPESA[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handlePagar() {
    if (!despesa) return;
    setSaving(true);
    setError("");
    const result = await pagarDespesa(despesa.id, { pagoEm, formaPagamento: forma });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open={!!despesa} onClose={onClose} size="md">
      <ModalHeader title="Pagar despesa" onClose={onClose} />
      <ModalBody>
        {despesa && (
          <div className="space-y-4">
            <div className="rounded-[6px] border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-sm font-medium text-gray-800">{despesa.descricao}</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(despesa.valor)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Data do pagamento</Label>
                <Input type="date" value={pagoEm} max={hoje} onChange={(e) => setPagoEm(e.target.value)} />
              </div>
              <div>
                <Label required>Forma de pagamento</Label>
                <Select value={forma} onChange={(e) => setForma(e.target.value)}>
                  {FORMAS_PAGAMENTO_DESPESA.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        )}
        <ErrorBox message={error} />
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handlePagar} disabled={saving}>
          {saving ? "Registrando..." : "Confirmar pagamento"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
