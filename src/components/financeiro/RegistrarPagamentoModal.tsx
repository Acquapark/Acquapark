"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Field";
import { FORMAS_PAGAMENTO_MENSALIDADE } from "@/lib/financeiro-constantes";
import { formatCurrency, formatDate } from "@/lib/utils";
import { registrarPagamento } from "@/app/(app)/associados/actions";

export interface MensalidadeParaBaixa {
  id: string;
  associadoId: string;
  vencimento: string;
  valor: number;
  descricao?: string;
}

export function RegistrarPagamentoModal({
  mensalidade,
  onClose,
}: {
  mensalidade: MensalidadeParaBaixa | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [forma, setForma] = useState("Pix");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirmar() {
    if (!mensalidade) return;
    setSaving(true);
    setError("");
    const result = await registrarPagamento(mensalidade.id, mensalidade.associadoId, {
      formaPagamento: forma,
      valor: mensalidade.valor,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open={!!mensalidade} onClose={onClose} size="md">
      <ModalHeader title="Registrar pagamento" onClose={onClose} />
      <ModalBody>
        {mensalidade && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              {mensalidade.descricao ? `${mensalidade.descricao} — ` : "Mensalidade "}
              vencimento {formatDate(mensalidade.vencimento)} — {formatCurrency(mensalidade.valor)}
            </p>
            <div>
              <Label required>Forma de pagamento</Label>
              <Select value={forma} onChange={(e) => setForma(e.target.value)}>
                {FORMAS_PAGAMENTO_MENSALIDADE.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
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
        <Button onClick={handleConfirmar} disabled={saving}>
          {saving ? "Registrando..." : "Confirmar pagamento"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
