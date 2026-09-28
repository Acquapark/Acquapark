"use client";

import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { imprimirIngressos } from "@/lib/print-ingresso";
import { Ingresso } from "@/types";

export function IngressosLoteModal({
  open,
  onClose,
  ingressos,
}: {
  open: boolean;
  onClose: () => void;
  ingressos: Ingresso[];
}) {
  const total = ingressos.reduce((soma, i) => soma + i.valor, 0);
  const primeiro = ingressos[0];

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader title={`${ingressos.length} ingressos emitidos com sucesso`} onClose={onClose} />
      <ModalBody>
        {primeiro && (
          <p className="mb-4 text-sm text-gray-600">
            {primeiro.tipo} · {primeiro.semExpiracao ? "Sem expiração" : `válido em ${formatDate(primeiro.dataUtilizacao)}`} · total{" "}
            <strong className="text-gray-900">{formatCurrency(total)}</strong>
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ingressos.map((i) => (
            <div key={i.id} className="flex flex-col items-center gap-2 rounded-[6px] border border-gray-200 p-3">
              {i.codigo && <QRCodeSVG value={i.codigo} size={96} />}
              <span className="text-sm font-medium text-gray-800">{i.numero}</span>
              <span className="font-mono text-[10px] break-all text-gray-400">{i.codigo}</span>
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={() => imprimirIngressos(ingressos.map((i) => i.id))}>
          <Printer size={14} />
          Imprimir todos
        </Button>
        <Button onClick={onClose}>Fechar</Button>
      </ModalFooter>
    </Modal>
  );
}
