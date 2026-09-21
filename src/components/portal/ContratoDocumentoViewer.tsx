"use client";

import { useState } from "react";
import { Download, Eye, X } from "lucide-react";
import { ContratoGerado } from "@/lib/supabase/contratos";

export function ContratoDocumentoViewer({ documento }: { documento: ContratoGerado | null }) {
  const [viewing, setViewing] = useState(false);

  if (!documento) {
    return (
      <div className="rounded-[10px] border border-dashed border-gray-300 bg-white p-4 text-center text-xs text-gray-400">
        Nenhum documento de contrato foi gerado ainda.
      </div>
    );
  }

  function handleDownload() {
    if (!documento) return;
    const blob = new Blob(
      [
        `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato ${documento.numero}</title></head><body>${documento.conteudoHtml}</body></html>`,
      ],
      { type: "text/html" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contrato-${documento.numero}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setViewing(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-[8px] border border-gray-300 text-sm font-medium text-gray-700"
        >
          <Eye size={16} />
          Visualizar
        </button>
        <button
          onClick={handleDownload}
          className="flex h-12 items-center justify-center gap-2 rounded-[8px] bg-primary-600 text-sm font-medium text-white"
        >
          <Download size={16} />
          Baixar
        </button>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-30 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Contrato {documento.numero}</p>
            <button onClick={() => setViewing(false)} className="flex h-8 w-8 items-center justify-center rounded-[6px] text-gray-400 hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
          <div
            className="prose prose-sm max-w-none flex-1 overflow-y-auto p-5 text-sm leading-relaxed text-gray-800 [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2"
            dangerouslySetInnerHTML={{ __html: documento.conteudoHtml }}
          />
        </div>
      )}
    </>
  );
}
