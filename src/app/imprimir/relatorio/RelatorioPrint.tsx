"use client";

import { useEffect } from "react";
import { RelatorioConteudo } from "@/components/relatorios/RelatorioConteudo";
import { Relatorio, formatarCelula, rotuloPeriodo } from "@/lib/relatorios/tipos";

export function RelatorioPrint({
  relatorio,
  empresaNome,
  empresaCnpj,
  auto,
}: {
  relatorio: Relatorio;
  empresaNome: string;
  empresaCnpj: string;
  auto: boolean;
}) {
  useEffect(() => {
    if (!auto) return;
    const timer = setTimeout(() => window.print(), 500);
    return () => clearTimeout(timer);
  }, [auto]);

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:min-h-0 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 12mm; } @media print { html, body { background: #fff !important; } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4 print:hidden">
        <p className="text-xs text-gray-500">Na janela de impressão, escolha &quot;Salvar como PDF&quot; como destino.</p>
        <button
          onClick={() => window.print()}
          className="rounded-[4px] bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Imprimir / Salvar PDF
        </button>
      </div>

      <div className="mx-auto max-w-[210mm] bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="mb-5 border-b-2 border-gray-800 pb-3">
          <p className="text-sm font-bold text-gray-900 uppercase">{empresaNome}</p>
          {empresaCnpj && <p className="text-[11px] text-gray-500">CNPJ {empresaCnpj}</p>}
          <h1 className="mt-2 text-xl font-bold text-gray-900">Relatório de {relatorio.titulo}</h1>
          <p className="text-xs text-gray-600">
            {rotuloPeriodo(relatorio.periodo)} · gerado em {formatarCelula(relatorio.geradoEm, "dataHora")}
          </p>
        </header>

        <RelatorioConteudo relatorio={relatorio} impressao />
      </div>
    </div>
  );
}
