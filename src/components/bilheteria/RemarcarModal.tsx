"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { formatDate } from "@/lib/utils";
import type { ResultadoRemarcacao } from "@/app/(app)/bilheteria/actions";

function hojeBR() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Escolher a nova data de utilização (um ingresso, um pedido online ou um dia
 * inteiro). Quem chama decide o que remarcar; o QR Code não muda.
 */
export function RemarcarModal({
  open,
  onClose,
  titulo,
  descricao,
  dataAtual,
  onConfirmar,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  descricao: React.ReactNode;
  /** Data atual dos ingressos (não pode ser escolhida de novo). */
  dataAtual?: string;
  onConfirmar: (novaData: string, motivo: string) => Promise<{ error: string } | ResultadoRemarcacao>;
}) {
  const router = useRouter();
  const [novaData, setNovaData] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<ResultadoRemarcacao | null>(null);

  async function confirmar() {
    if (!novaData) {
      setError("Escolha a nova data.");
      return;
    }
    if (novaData === dataAtual) {
      setError("Escolha uma data diferente da atual.");
      return;
    }
    setSalvando(true);
    setError("");
    const result = await onConfirmar(novaData, motivo);
    setSalvando(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setResultado(result);
    router.refresh();
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader title={titulo} onClose={onClose} />
      <ModalBody>
        {resultado ? (
          <div className="space-y-2 text-sm text-gray-700">
            <p className="flex items-center gap-2 font-medium text-success-700">
              <CalendarClock size={16} />
              {resultado.quantidade === 0
                ? "Não havia ingressos para remarcar."
                : `${resultado.quantidade} ingresso(s) remarcado(s) para ${formatDate(novaData)}.`}
            </p>
            {resultado.emailsEnviados > 0 && <p>{resultado.emailsEnviados} comprador(es) online avisado(s) por e-mail.</p>}
            {resultado.falhasEmail.length > 0 && (
              <p className="text-warning-700">
                {resultado.falhasEmail.length} e-mail(s) não foram enviados ({resultado.falhasEmail[0]}). Avise esses compradores por
                outro meio.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">{descricao}</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label required>Nova data</Label>
                <Input type="date" min={hojeBR()} value={novaData} onChange={(e) => setNovaData(e.target.value)} />
              </div>
              <div>
                <Label>Motivo</Label>
                <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: chuva forte" maxLength={120} />
              </div>
            </div>
            <p className="text-[11px] text-gray-400">
              O QR Code dos ingressos continua o mesmo. Compradores online recebem um e-mail com a nova data. Ingressos da venda
              online só podem ir para dias marcados como abertos.
            </p>
            {error && (
              <div className="rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</div>
            )}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={salvando}>
          {resultado ? "Fechar" : "Cancelar"}
        </Button>
        {!resultado && (
          <Button onClick={confirmar} disabled={salvando}>
            {salvando ? "Remarcando..." : "Remarcar"}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
