"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import { desfazerPagamentoMensalidade, excluirRecebimento } from "@/app/(app)/financeiro/actions";

export interface RecebimentoParaExcluir {
  /** "pagamento" = lançamento da aba Recebimentos; "mensalidade" = parcela paga no perfil do associado. */
  tipo: "pagamento" | "mensalidade";
  id: string;
  descricao: string;
  valor: number;
  ehMensalidade: boolean;
}

export function ExcluirRecebimentoModal({ alvo, onClose }: { alvo: RecebimentoParaExcluir | null; onClose: () => void }) {
  const router = useRouter();
  const [excluindo, setExcluindo] = useState(false);
  const [error, setError] = useState("");

  async function confirmar() {
    if (!alvo) return;
    setExcluindo(true);
    setError("");
    const result = alvo.tipo === "pagamento" ? await excluirRecebimento(alvo.id) : await desfazerPagamentoMensalidade(alvo.id);
    setExcluindo(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open={!!alvo} onClose={onClose} size="md">
      <ModalHeader title="Excluir recebimento?" onClose={onClose} />
      <ModalBody>
        {alvo && (
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <span className="font-medium text-gray-800">{alvo.descricao}</span> · {formatCurrency(alvo.valor)}
            </p>
            {alvo.ehMensalidade ? (
              <p>
                O pagamento é apagado e a mensalidade volta a ficar <strong>em aberto</strong>, podendo ser cobrada de novo. Se for a
                1ª parcela, o associado volta para <strong>Pendente</strong>.
              </p>
            ) : (
              <p>O lançamento é apagado e sai dos totais do Financeiro.</p>
            )}
            {alvo.ehMensalidade && (
              <p className="rounded-[4px] border border-warning-600/30 bg-warning-50 px-3 py-2 text-xs text-warning-700">
                Se o pagamento foi feito pela Asaas (Pix, boleto ou cartão), o dinheiro <strong>não</strong> é devolvido por aqui — faça
                o estorno direto na Asaas, se for o caso.
              </p>
            )}
            {error && <p className="text-xs text-danger-600">{error}</p>}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={excluindo}>
          Voltar
        </Button>
        <Button variant="destructive" onClick={confirmar} disabled={excluindo}>
          {excluindo ? "Excluindo..." : "Excluir recebimento"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
