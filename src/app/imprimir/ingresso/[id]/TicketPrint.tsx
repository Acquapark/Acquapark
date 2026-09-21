"use client";

import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export interface TicketData {
  numero: string;
  codigo: string;
  tipo: string;
  comprador: string;
  dataUtilizacao: string;
  valor: number;
  formaPagamento: string | null;
  regraReentrada: "unica" | "reentrada" | "ilimitado";
  emitidoEm: string;
}

const REGRA_TEXTO: Record<TicketData["regraReentrada"], string> = {
  unica: "Entrada única.",
  reentrada: "Permite reentrada no mesmo dia.",
  ilimitado: "Acesso ilimitado no dia.",
};

export function TicketPrint({
  ticket,
  empresaNome,
  empresaCnpj,
  width,
  auto,
}: {
  ticket: TicketData;
  empresaNome: string;
  empresaCnpj: string;
  width: "80" | "58";
  auto: boolean;
}) {
  // Área imprimível típica: 72mm no papel de 80mm e 48mm no de 58mm.
  const larguraMm = width === "58" ? 48 : 72;
  const qrMm = width === "58" ? 34 : 46;

  useEffect(() => {
    if (!auto) return;
    const notificar = () => {
      if (window.parent !== window) window.parent.postMessage("ingresso-impresso", window.location.origin);
    };
    window.addEventListener("afterprint", notificar);
    // Espera o QR Code renderizar antes de abrir o diálogo de impressão.
    const timer = setTimeout(() => window.print(), 400);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", notificar);
    };
  }, [auto]);

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:min-h-0 print:bg-white print:py-0">
      <style>{`@page { margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>

      <div className="mb-4 flex justify-center gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-[4px] bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Imprimir
        </button>
      </div>

      <div
        className="mx-auto bg-white p-0 text-black shadow-sm print:shadow-none"
        style={{ width: `${larguraMm}mm`, fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        <div style={{ padding: "3mm 2mm 12mm", textAlign: "center" }}>
          <p style={{ fontSize: "15px", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.2 }}>{empresaNome}</p>
          {empresaCnpj && <p style={{ fontSize: "10px" }}>CNPJ {empresaCnpj}</p>}

          <div style={{ borderTop: "1px dashed #000", margin: "3mm 0" }} />

          <p style={{ fontSize: "11px", letterSpacing: "1px" }}>INGRESSO</p>
          <p style={{ fontSize: "16px", fontWeight: 700, lineHeight: 1.2, margin: "1mm 0 3mm" }}>{ticket.tipo}</p>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <QRCodeSVG
              value={ticket.codigo}
              size={200}
              level="M"
              marginSize={0}
              style={{ width: `${qrMm}mm`, height: `${qrMm}mm` }}
            />
          </div>

          <p style={{ fontSize: "15px", fontWeight: 700, margin: "3mm 0 1mm" }}>{ticket.numero}</p>
          <p style={{ fontSize: "12px" }}>{ticket.comprador}</p>

          <div style={{ borderTop: "1px dashed #000", margin: "3mm 0" }} />

          <div style={{ fontSize: "12px", textAlign: "left", lineHeight: 1.6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Válido em</span>
              <strong>{formatDate(ticket.dataUtilizacao)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Valor</span>
              <strong>{formatCurrency(ticket.valor)}</strong>
            </div>
            {ticket.formaPagamento && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Pagamento</span>
                <span>{ticket.formaPagamento}</span>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px dashed #000", margin: "3mm 0" }} />

          <p style={{ fontSize: "10px", lineHeight: 1.4 }}>
            Apresente este QR Code na catraca.
            <br />
            {REGRA_TEXTO[ticket.regraReentrada]} Válido somente na data indicada.
          </p>
          <p style={{ fontSize: "9px", marginTop: "2mm" }}>Emitido em {formatDateTime(ticket.emitidoEm)}</p>
        </div>
      </div>
    </div>
  );
}
