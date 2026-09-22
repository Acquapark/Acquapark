"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer, Waves } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const CARD_W = 560;
const CARD_H = 840;

export function CredencialCard({
  nome,
  numero,
  planoNome,
  codigo,
  ativa,
}: {
  nome: string;
  numero: string;
  planoNome: string | null;
  codigo: string;
  ativa: boolean;
}) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [downloading, setDownloading] = useState(false);
  const iniciais = nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  function handleDownload() {
    const qrCanvas = qrCanvasRef.current;
    if (!qrCanvas) return;
    setDownloading(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const radius = 32;
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.arcTo(CARD_W, 0, CARD_W, CARD_H, radius);
      ctx.arcTo(CARD_W, CARD_H, 0, CARD_H, radius);
      ctx.arcTo(0, CARD_H, 0, 0, radius);
      ctx.arcTo(0, 0, CARD_W, 0, radius);
      ctx.closePath();
      ctx.clip();

      const gradient = ctx.createLinearGradient(0, 0, 0, CARD_H);
      gradient.addColorStop(0, "#2563eb");
      gradient.addColorStop(1, "#1e40af");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CARD_W, CARD_H);

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";

      ctx.font = "700 24px system-ui, sans-serif";
      ctx.fillText("AQUA PARK", CARD_W / 2, 70);

      ctx.beginPath();
      ctx.arc(CARD_W / 2, 190, 80, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 44px system-ui, sans-serif";
      ctx.fillText(iniciais, CARD_W / 2, 205);

      ctx.font = "700 26px system-ui, sans-serif";
      ctx.fillText(nome.toUpperCase(), CARD_W / 2, 330);

      ctx.font = "400 20px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(`Nº ${numero}`, CARD_W / 2, 365);
      ctx.fillText(planoNome ? `Plano ${planoNome}` : "Sem plano ativo", CARD_W / 2, 395);

      const qrSize = 260;
      const qrX = (CARD_W - qrSize) / 2;
      const qrY = 430;
      const pad = 20;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      const r = 12;
      const bx = qrX - pad;
      const by = qrY - pad;
      const bw = qrSize + pad * 2;
      const bh = qrSize + pad * 2;
      ctx.moveTo(bx + r, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
      ctx.arcTo(bx, by + bh, bx, by, r);
      ctx.arcTo(bx, by, bx + bw, by, r);
      ctx.closePath();
      ctx.fill();
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 18px system-ui, sans-serif";
      ctx.fillText(ativa ? "● ASSOCIAÇÃO ATIVA" : "● INATIVA", CARD_W / 2, qrY + qrSize + pad + 50);

      const link = document.createElement("a");
      link.download = `credencial-${numero}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        id="credencial-para-imprimir"
        className="w-full max-w-[280px] overflow-hidden rounded-[8px] border border-gray-200 p-5 text-center text-white shadow-sm"
        style={{ backgroundImage: "linear-gradient(to bottom, #2563eb, #1e40af)" }}
      >
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold tracking-wide">
          <Waves size={14} />
          AQUA PARK
        </div>

        <div className="mx-auto mt-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-[rgba(255,255,255,0.4)] bg-[rgba(255,255,255,0.1)] text-2xl font-semibold">
          {iniciais}
        </div>

        <p className="mt-3 text-sm font-semibold uppercase">{nome}</p>
        <p className="text-xs text-[rgba(255,255,255,0.8)]">Nº {numero}</p>
        <p className="text-xs text-[rgba(255,255,255,0.8)]">{planoNome ? `Plano ${planoNome}` : "Sem plano ativo"}</p>

        <div className="mx-auto mt-4 w-fit rounded-[6px] bg-white p-2">
          <QRCodeCanvas ref={qrCanvasRef} value={codigo} size={120} />
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {ativa ? "ASSOCIAÇÃO ATIVA" : "INATIVA"}
        </div>
      </div>

      {!ativa && <Badge tone="danger">Sua associação não está ativa no momento</Badge>}

      <div className="flex w-full max-w-[280px] flex-wrap justify-center gap-2 print:hidden">
        <Button variant="secondary" size="sm" onClick={handleDownload} disabled={downloading}>
          <Download size={14} />
          {downloading ? "Gerando..." : "Baixar credencial"}
        </Button>
        <Button variant="secondary" size="sm" onClick={handlePrint}>
          <Printer size={14} />
          Imprimir
        </Button>
      </div>

      <p className="max-w-sm text-center text-[11px] text-gray-400 print:hidden">
        O QR Code não contém dados pessoais — apenas um identificador único validado pelo servidor no momento da leitura na
        catraca.
      </p>
    </div>
  );
}
