"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, ClipboardCopy, Printer } from "lucide-react";
import { imprimirIngresso } from "@/lib/print-ingresso";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusBadge, StatusMaps } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Ingresso } from "@/types";

export function IngressoQrModal({
  open,
  onClose,
  ingresso,
  title = "QR Code do ingresso",
}: {
  open: boolean;
  onClose: () => void;
  ingresso: Ingresso | null;
  title?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!ingresso?.codigo) return;
    try {
      await navigator.clipboard.writeText(ingresso.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponível — o código continua visível na tela
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader title={title} onClose={onClose} />
      <ModalBody>
        {ingresso && ingresso.codigo && (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-[6px] border border-gray-200 bg-white p-3">
              <QRCodeSVG value={ingresso.codigo} size={200} />
            </div>

            <div className="w-full space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Ingresso</span>
                <span className="font-medium text-gray-800">{ingresso.numero}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tipo</span>
                <span className="text-gray-800">{ingresso.tipo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Comprador</span>
                <span className="text-gray-800">{ingresso.comprador}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Válido em</span>
                <span className="text-gray-800">{formatDate(ingresso.dataUtilizacao)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Valor</span>
                <span className="text-gray-800">{formatCurrency(ingresso.valor)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Status</span>
                <StatusBadge status={ingresso.status} map={StatusMaps.ingresso} />
              </div>
            </div>

            <div className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 text-center font-mono text-[11px] break-all text-gray-500">
              {ingresso.codigo}
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        {ingresso && ingresso.status !== "Cancelado" && (
          <Button variant="secondary" onClick={() => imprimirIngresso(ingresso.id)}>
            <Printer size={14} />
            Imprimir
          </Button>
        )}
        <Button variant="secondary" onClick={copiar}>
          {copiado ? <Check size={14} /> : <ClipboardCopy size={14} />}
          {copiado ? "Copiado" : "Copiar código"}
        </Button>
        <Button onClick={onClose}>Fechar</Button>
      </ModalFooter>
    </Modal>
  );
}
