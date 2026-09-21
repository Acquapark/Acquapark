"use client";

import { Check } from "lucide-react";
import { Label, Input, Select, Textarea } from "@/components/ui/Field";
import { AssociadoFormState } from "../form-types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Plano } from "@/types";
import { gerarParcelas } from "@/lib/mensalidades-engine";

export function StepPlano({
  form,
  update,
  planos,
}: {
  form: AssociadoFormState;
  update: (patch: Partial<AssociadoFormState>) => void;
  planos: Plano[];
}) {
  const plano = planos.find((p) => p.id === form.planoId);

  function handleSelectPlano(id: string) {
    const selected = planos.find((p) => p.id === id);
    update({
      planoId: id,
      valorMensalidade: selected ? String(selected.valor.toFixed(2)) : "",
      primeiraParcelaData: "",
    });
  }

  const valor = form.valorMensalidade ? Number(form.valorMensalidade.replace(",", ".")) : plano?.valor ?? 0;
  const podeGerarPreview =
    !!plano &&
    !!form.dataInicio &&
    (plano.regraPrimeiraParcela !== "manual" || !!form.primeiraParcelaData);
  const previewParcelas = podeGerarPreview
    ? gerarParcelas({
        dataInicio: form.dataInicio,
        diaVencimento: plano!.diaVencimento,
        quantidadeMensalidades: plano!.quantidadeMensalidades,
        valor,
        primeiraParcelaVencimento:
          plano!.regraPrimeiraParcela === "adesao"
            ? form.dataInicio
            : plano!.regraPrimeiraParcela === "manual"
              ? form.primeiraParcelaData
              : undefined,
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Label required>Plano</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {planos.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectPlano(p.id)}
              className={cn(
                "rounded-[6px] border p-3 text-left transition-colors",
                form.planoId === p.id ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{p.nome}</span>
                {form.planoId === p.id && <Check size={15} className="text-primary-600" />}
              </div>
              <p className="mt-1 text-base font-semibold text-gray-900">{formatCurrency(p.valor)}</p>
              <p className="text-xs text-gray-500">{p.dependentesPermitidos} dependente(s) incluído(s)</p>
            </button>
          ))}
        </div>
      </div>

      {plano && (
        <div className="rounded-[4px] border border-primary-100 bg-primary-50 px-4 py-3">
          <p className="text-xs font-semibold text-primary-700">Benefícios do plano {plano.nome}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {plano.beneficios.map((b) => (
              <span key={b} className="rounded-[4px] border border-primary-200 bg-white px-2 py-0.5 text-xs text-primary-700">
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label required>Data de início</Label>
          <Input type="date" value={form.dataInicio} onChange={(e) => update({ dataInicio: e.target.value })} />
        </div>
        <div>
          <Label>Dia de vencimento</Label>
          <Input value={plano ? `Dia ${plano.diaVencimento}` : "—"} disabled />
          <p className="mt-1 text-[11px] text-gray-400">Definido no cadastro do plano.</p>
        </div>
        <div>
          <Label>Mensalidades</Label>
          <Input value={plano ? `${plano.quantidadeMensalidades}x` : "—"} disabled />
          <p className="mt-1 text-[11px] text-gray-400">Definido no cadastro do plano.</p>
        </div>

        {plano?.regraPrimeiraParcela === "manual" ? (
          <div>
            <Label required>Vencimento da 1ª parcela</Label>
            <Input
              type="date"
              value={form.primeiraParcelaData}
              onChange={(e) => update({ primeiraParcelaData: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-gray-400">Este plano exige a escolha manual da data.</p>
          </div>
        ) : plano?.regraPrimeiraParcela === "adesao" ? (
          <div>
            <Label>1ª parcela</Label>
            <Input value="Usa a data de início acima" disabled />
            <p className="mt-1 text-[11px] text-gray-400">Configuração do plano: primeira parcela = data da adesão.</p>
          </div>
        ) : null}

        <div>
          <Label>Valor da mensalidade</Label>
          <Input
            value={form.valorMensalidade}
            onChange={(e) => update({ valorMensalidade: e.target.value })}
            placeholder="0,00"
          />
          <p className="mt-1 text-[11px] text-gray-400">Alteração manual requer permissão de gerente.</p>
        </div>
        <div>
          <Label>Forma de pagamento</Label>
          <Select value={form.formaPagamento} onChange={(e) => update({ formaPagamento: e.target.value })}>
            <option value="">Selecione</option>
            <option value="Cartão de crédito">Cartão de crédito</option>
            <option value="Débito automático">Débito automático</option>
            <option value="Pix">Pix</option>
            <option value="Boleto">Boleto</option>
          </Select>
        </div>
        <div>
          <Label>Desconto (%)</Label>
          <Input value={form.desconto} onChange={(e) => update({ desconto: e.target.value })} placeholder="0" />
        </div>
      </div>

      {podeGerarPreview && (
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-600">
            Resumo das parcelas que serão geradas ({previewParcelas.length})
          </p>
          <div className="max-h-56 overflow-y-auto rounded-[6px] border border-gray-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Parcela</th>
                  <th className="px-3 py-2 text-left">Vencimento</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {previewParcelas.map((p) => (
                  <tr key={p.numeroParcela} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-700">
                      {p.numeroParcela}/{p.totalParcelas}
                    </td>
                    <td className="px-3 py-1.5 text-gray-700">{formatDate(p.vencimento)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700">{formatCurrency(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <Label>Observações</Label>
        <Textarea value={form.planoObservacoes} onChange={(e) => update({ planoObservacoes: e.target.value })} />
      </div>
    </div>
  );
}
