"use client";

import { FileText, Download, Eye } from "lucide-react";
import { Label, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { AssociadoFormState } from "../form-types";
import { formatCurrency } from "@/lib/utils";
import { Plano } from "@/types";

export function StepContrato({
  form,
  update,
  planos,
}: {
  form: AssociadoFormState;
  update: (patch: Partial<AssociadoFormState>) => void;
  planos: Plano[];
}) {
  const plano = planos.find((p) => p.id === form.planoId);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label>Número do contrato</Label>
          <Input value={form.numeroContrato} onChange={(e) => update({ numeroContrato: e.target.value })} placeholder="Gerado automaticamente" disabled />
        </div>
        <div>
          <Label>Plano contratado</Label>
          <Input value={plano ? `${plano.nome} — ${formatCurrency(plano.valor)}` : "—"} disabled />
        </div>
      </div>

      <div>
        <Label>Observações do contrato</Label>
        <Textarea value={form.contratoObservacoes} onChange={(e) => update({ contratoObservacoes: e.target.value })} />
      </div>

      <div className="flex items-center gap-3 rounded-[6px] border border-gray-200 bg-gray-50 px-4 py-3">
        <FileText size={20} className="text-gray-400" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700">Contrato de adesão</p>
          <p className="text-xs text-gray-500">O contrato será gerado após salvar o cadastro do associado.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled>
            <Eye size={14} />
            Visualizar
          </Button>
          <Button variant="secondary" size="sm" disabled>
            <Download size={14} />
            Baixar
          </Button>
          <Button size="sm" disabled={!form.nome || !form.planoId}>
            <FileText size={14} />
            Gerar contrato
          </Button>
        </div>
      </div>
    </div>
  );
}
