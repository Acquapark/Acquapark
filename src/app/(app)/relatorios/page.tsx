"use client";

import { useState } from "react";
import { Download, FileBarChart2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Input, Select } from "@/components/ui/Field";

const RELATORIOS = [
  { id: "vendas", nome: "Vendas", descricao: "Ingressos e mensalidades vendidos no período" },
  { id: "entradas", nome: "Entradas", descricao: "Total de entradas registradas por catraca" },
  { id: "saidas", nome: "Saídas", descricao: "Total de saídas registradas por catraca" },
  { id: "associados", nome: "Associados", descricao: "Base de associados ativos, pendentes e inativos" },
  { id: "inadimplencia", nome: "Inadimplência", descricao: "Mensalidades vencidas por associado" },
  { id: "faturamento", nome: "Faturamento", descricao: "Receita consolidada por período" },
  { id: "utilizacao", nome: "Utilização do parque", descricao: "Frequência e horários de pico" },
  { id: "pagamentos", nome: "Formas de pagamento", descricao: "Distribuição de recebimentos por forma de pagamento" },
  { id: "acessos", nome: "Histórico de acessos", descricao: "Log completo de entradas, saídas e reentradas" },
];

export default function RelatoriosPage() {
  const [selected, setSelected] = useState(RELATORIOS[0].id);
  const relatorio = RELATORIOS.find((r) => r.id === selected)!;

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Filtre por período e exporte os dados operacionais" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <div className="divide-y divide-gray-100">
            {RELATORIOS.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={`flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors ${
                  selected === r.id ? "bg-primary-50" : "hover:bg-gray-50"
                }`}
              >
                <FileBarChart2 size={16} className={selected === r.id ? "text-primary-600" : "text-gray-400"} />
                <div>
                  <p className={`text-sm font-medium ${selected === r.id ? "text-primary-700" : "text-gray-700"}`}>{r.nome}</p>
                  <p className="text-xs text-gray-500">{r.descricao}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-end gap-3 border-b border-gray-200 p-4">
            <div>
              <Label>Data inicial</Label>
              <Input type="date" className="w-40" />
            </div>
            <div>
              <Label>Data final</Label>
              <Input type="date" className="w-40" />
            </div>
            <div>
              <Label>Formato</Label>
              <Select className="w-32">
                <option>PDF</option>
                <option>Excel</option>
                <option>CSV</option>
              </Select>
            </div>
            <Button variant="secondary">Filtrar</Button>
            <Button className="ml-auto">
              <Download size={15} />
              Exportar
            </Button>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <FileBarChart2 size={32} className="text-gray-300" />
            <p className="text-sm font-medium text-gray-600">Relatório: {relatorio.nome}</p>
            <p className="max-w-sm text-xs text-gray-400">
              Selecione o período e clique em &quot;Filtrar&quot; para visualizar os dados de {relatorio.nome.toLowerCase()}.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
