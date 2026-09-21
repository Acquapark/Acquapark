"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Label, Input } from "@/components/ui/Field";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Contrato, Plano } from "@/types";
import { vincularPlano } from "@/app/(app)/associados/actions";
import { parcelasDoPlano } from "@/lib/mensalidades-engine";
import { useAcesso } from "@/components/providers/AcessoProvider";

export function ProfilePlanoTab({
  associadoId,
  contratoAtivo,
  planos,
}: {
  associadoId: string;
  contratoAtivo: Contrato | null;
  planos: Plano[];
}) {
  const router = useRouter();
  const { pode } = useAcesso();
  const [planoId, setPlanoId] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [primeiraParcelaData, setPrimeiraParcelaData] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const planoSelecionado = planos.find((p) => p.id === planoId);

  function handleSelectPlano(id: string) {
    setPlanoId(id);
    setPrimeiraParcelaData("");
  }

  const previewParcelas = planoSelecionado
    ? parcelasDoPlano(planoSelecionado, dataInicio, planoSelecionado.valor, primeiraParcelaData)
    : [];
  const podeGerarPreview = previewParcelas.length > 0;
  const aniversario = planoSelecionado?.vencimentoNaContratacao === true;

  async function handleVincular() {
    if (!planoId || !dataInicio) {
      setError("Selecione um plano e a data de início.");
      return;
    }
    if (!aniversario && planoSelecionado?.regraPrimeiraParcela === "manual" && !primeiraParcelaData) {
      setError("Este plano exige a escolha manual da data da 1ª parcela.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await vincularPlano(associadoId, planoId, dataInicio, undefined, primeiraParcelaData || undefined);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (contratoAtivo) {
    return (
      <div className="max-w-lg">
        <Card>
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">{contratoAtivo.planoNome}</p>
              <Badge tone="success">{contratoAtivo.status}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Contrato</p>
                <p className="text-gray-800">{contratoAtivo.numero}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Valor da mensalidade</p>
                <p className="text-gray-800">{formatCurrency(contratoAtivo.valor)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Início</p>
                <p className="text-gray-800">{formatDate(contratoAtivo.dataInicio)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Mensalidades</p>
                <p className="text-gray-800">{contratoAtivo.quantidadeMensalidades}x</p>
              </div>
            </div>
          </div>
        </Card>
        <p className="mt-3 text-xs text-gray-400">
          Estas foram as condições contratadas nesta adesão — alterar o plano no cadastro não muda este contrato nem as
          mensalidades já geradas. Renovação e troca de plano serão implementadas futuramente.
        </p>
      </div>
    );
  }

  if (!pode("planos_associado.criar")) {
    return <p className="text-sm text-gray-500">Este associado ainda não tem um contrato ativo.</p>;
  }

  return (
    <div className="max-w-2xl">
      <p className="mb-1 text-sm font-medium text-gray-700">Vincular plano</p>
      <p className="mb-4 text-xs text-gray-500">
        Este associado ainda não tem um contrato ativo. Selecione um plano para gerar o contrato e as mensalidades
        automaticamente.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {planos.map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelectPlano(p.id)}
            className={cn(
              "rounded-[6px] border p-3 text-left transition-colors",
              planoId === p.id ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">{p.nome}</span>
              {planoId === p.id && <Check size={15} className="text-primary-600" />}
            </div>
            <p className="mt-1 text-base font-semibold text-gray-900">{formatCurrency(p.valor)}</p>
            <p className="text-xs text-gray-500">
              {p.quantidadeMensalidades}x · vence {p.vencimentoNaContratacao ? "na data da contratação" : `dia ${p.diaVencimento}`}
            </p>
          </button>
        ))}
      </div>

      {planoSelecionado && (
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <Label required>Data de início</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>

          {aniversario && (
            <p className="text-xs text-gray-500">Todas as parcelas vencem no dia do mês da data de início.</p>
          )}
          {!aniversario && planoSelecionado.regraPrimeiraParcela === "manual" && (
            <div>
              <Label required>Vencimento da 1ª parcela</Label>
              <Input type="date" value={primeiraParcelaData} onChange={(e) => setPrimeiraParcelaData(e.target.value)} />
            </div>
          )}
          {!aniversario && planoSelecionado.regraPrimeiraParcela === "adesao" && (
            <p className="text-xs text-gray-500">A 1ª parcela usará a data de início acima.</p>
          )}

          <Button onClick={handleVincular} disabled={saving}>
            <Link2 size={14} />
            {saving ? "Vinculando..." : "Vincular plano"}
          </Button>
        </div>
      )}

      {podeGerarPreview && (
        <div className="mt-4">
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

      {error && (
        <div className="mt-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
          {error}
        </div>
      )}
    </div>
  );
}
