import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Coluna, Relatorio, Secao, formatarCelula } from "@/lib/relatorios/tipos";

const DIREITA = new Set(["moeda", "numero", "percentual"]);

function alinhamento(coluna: Coluna) {
  return DIREITA.has(coluna.tipo ?? "texto") ? "text-right" : "text-left";
}

function TabelaSecao({ secao, impressao }: { secao: Secao; impressao: boolean }) {
  return (
    <div className="mb-6 break-inside-auto">
      {secao.titulo && <h3 className="mb-2 text-sm font-semibold text-gray-800">{secao.titulo}</h3>}
      <div className={cn("overflow-x-auto", !impressao && "rounded-[6px] border border-gray-200")}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={impressao ? "border-b-2 border-gray-800" : "bg-gray-50"}>
              {secao.colunas.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-3 py-2 text-xs font-semibold whitespace-nowrap",
                    impressao ? "text-gray-900" : "text-gray-500 uppercase",
                    alinhamento(c),
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {secao.linhas.length === 0 && (
              <tr>
                <td colSpan={secao.colunas.length} className="px-3 py-8 text-center text-sm text-gray-400">
                  Nenhum registro no período.
                </td>
              </tr>
            )}
            {secao.linhas.map((linha, i) => (
              <tr key={i} className="border-b border-gray-100 break-inside-avoid">
                {secao.colunas.map((c) => (
                  <td key={c.key} className={cn("px-3 py-1.5 text-gray-700", alinhamento(c))}>
                    {formatarCelula(linha[c.key], c.tipo)}
                  </td>
                ))}
              </tr>
            ))}
            {secao.totais && (
              <tr className={cn("font-semibold text-gray-900", impressao ? "border-t-2 border-gray-800" : "bg-gray-50")}>
                {secao.colunas.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2", alinhamento(c))}>
                    {secao.totais![c.key] === undefined ? "" : formatarCelula(secao.totais![c.key], c.tipo)}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RelatorioConteudo({ relatorio, impressao = false }: { relatorio: Relatorio; impressao?: boolean }) {
  return (
    <div>
      {relatorio.avisos.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {relatorio.avisos.map((aviso) => (
            <div
              key={aviso}
              className="flex items-start gap-2 rounded-[4px] border border-warning-600/30 bg-warning-50 px-3 py-2 text-xs text-warning-700"
            >
              <AlertTriangle size={14} className="mt-px shrink-0" />
              {aviso}
            </div>
          ))}
        </div>
      )}

      {relatorio.resumo.length > 0 && (
        <div className={cn("mb-5 grid gap-3", impressao ? "grid-cols-4" : "grid-cols-2 lg:grid-cols-4")}>
          {relatorio.resumo.map((item) => (
            <div key={item.label} className="rounded-[6px] border border-gray-200 px-3 py-2.5">
              <p className="text-[11px] text-gray-500">{item.label}</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">{item.valor}</p>
            </div>
          ))}
        </div>
      )}

      {relatorio.secoes.map((secao, i) => (
        <TabelaSecao key={i} secao={secao} impressao={impressao} />
      ))}
    </div>
  );
}
