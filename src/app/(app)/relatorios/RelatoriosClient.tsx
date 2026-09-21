"use client";

import { useState } from "react";
import { Download, FileBarChart2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Input, Select } from "@/components/ui/Field";
import { RelatorioConteudo } from "@/components/relatorios/RelatorioConteudo";
import { RELATORIOS, Relatorio, RelatorioId, formatarCelula, rotuloPeriodo } from "@/lib/relatorios/tipos";
import { baixarCsv, baixarExcel } from "@/lib/relatorios/exportar";
import { gerarRelatorioAction } from "./actions";

type Formato = "PDF" | "Excel" | "CSV";

export function RelatoriosClient({ inicioPadrao, fimPadrao }: { inicioPadrao: string; fimPadrao: string }) {
  const [selecionado, setSelecionado] = useState<RelatorioId>(RELATORIOS[0].id);
  const [de, setDe] = useState(inicioPadrao);
  const [ate, setAte] = useState(fimPadrao);
  const [formato, setFormato] = useState<Formato>("PDF");
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState("");

  const meta = RELATORIOS.find((r) => r.id === selecionado)!;
  const usaPeriodo = selecionado !== "associados";

  function selecionar(id: RelatorioId) {
    setSelecionado(id);
    setRelatorio(null);
    setErro("");
  }

  async function gerar() {
    setCarregando(true);
    setErro("");
    const resultado = await gerarRelatorioAction(selecionado, de, ate);
    setCarregando(false);
    if ("error" in resultado) {
      setErro(resultado.error);
      setRelatorio(null);
      return;
    }
    setRelatorio(resultado.relatorio);
  }

  async function exportar() {
    if (!relatorio) return;
    setExportando(true);
    try {
      if (formato === "CSV") baixarCsv(relatorio);
      else if (formato === "Excel") await baixarExcel(relatorio);
      else {
        const p = relatorio.periodo;
        const params = new URLSearchParams({ id: relatorio.id, auto: "1" });
        if (p) {
          params.set("de", p.de);
          params.set("ate", p.ate);
        }
        window.open(`/imprimir/relatorio?${params.toString()}`, "_blank");
      }
    } catch {
      setErro("Não foi possível exportar o arquivo. Tente novamente.");
    } finally {
      setExportando(false);
    }
  }

  const totalLinhas = relatorio?.secoes.reduce((s, sec) => s + sec.linhas.length, 0) ?? 0;

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Filtre por período e exporte os dados operacionais" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <div className="divide-y divide-gray-100">
            {RELATORIOS.map((r) => (
              <button
                key={r.id}
                onClick={() => selecionar(r.id)}
                className={`flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors ${
                  selecionado === r.id ? "bg-primary-50" : "hover:bg-gray-50"
                }`}
              >
                <FileBarChart2 size={16} className={selecionado === r.id ? "text-primary-600" : "text-gray-400"} />
                <div>
                  <p className={`text-sm font-medium ${selecionado === r.id ? "text-primary-700" : "text-gray-700"}`}>{r.nome}</p>
                  <p className="text-xs text-gray-500">{r.descricao}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="min-w-0">
          <div className="flex flex-wrap items-end gap-3 border-b border-gray-200 p-4">
            <div>
              <Label>Data inicial</Label>
              <Input type="date" className="w-40" value={de} onChange={(e) => setDe(e.target.value)} disabled={!usaPeriodo} />
            </div>
            <div>
              <Label>Data final</Label>
              <Input type="date" className="w-40" value={ate} onChange={(e) => setAte(e.target.value)} disabled={!usaPeriodo} />
            </div>
            <div>
              <Label>Formato</Label>
              <Select className="w-32" value={formato} onChange={(e) => setFormato(e.target.value as Formato)}>
                <option>PDF</option>
                <option>Excel</option>
                <option>CSV</option>
              </Select>
            </div>
            <Button variant="secondary" onClick={gerar} disabled={carregando}>
              {carregando ? <Loader2 size={15} className="animate-spin" /> : null}
              {carregando ? "Gerando..." : "Filtrar"}
            </Button>
            <Button className="ml-auto" onClick={exportar} disabled={!relatorio || exportando}>
              <Download size={15} />
              {exportando ? "Exportando..." : "Exportar"}
            </Button>
          </div>

          {erro && (
            <div className="mx-4 mt-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
              {erro}
            </div>
          )}

          {relatorio ? (
            <div className="p-4">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{relatorio.titulo}</h2>
                  <p className="text-xs text-gray-500">{rotuloPeriodo(relatorio.periodo)}</p>
                </div>
                <p className="text-xs text-gray-400">
                  {totalLinhas} linha(s) · gerado em {formatarCelula(relatorio.geradoEm, "dataHora")}
                </p>
              </div>
              <RelatorioConteudo relatorio={relatorio} />
            </div>
          ) : (
            !carregando && (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
                <FileBarChart2 size={32} className="text-gray-300" />
                <p className="text-sm font-medium text-gray-600">Relatório: {meta.nome}</p>
                <p className="max-w-sm text-xs text-gray-400">
                  {usaPeriodo
                    ? `Selecione o período e clique em "Filtrar" para visualizar os dados de ${meta.nome.toLowerCase()}.`
                    : `Clique em "Filtrar" para visualizar a base atual de ${meta.nome.toLowerCase()} (não usa período).`}
                </p>
              </div>
            )
          )}
        </Card>
      </div>
    </div>
  );
}
