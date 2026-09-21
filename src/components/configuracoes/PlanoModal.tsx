"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Input, Select, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { Plano, RegraPrimeiraParcela } from "@/types";
import { createPlano, updatePlano } from "@/app/(app)/configuracoes/actions";

export function PlanoModal({ open, onClose, plano }: { open: boolean; onClose: () => void; plano: Plano | null }) {
  const router = useRouter();
  const [nome, setNome] = useState(plano?.nome ?? "");
  const [valor, setValor] = useState(plano ? String(plano.valor.toFixed(2)) : "");
  const [dependentesPermitidos, setDependentesPermitidos] = useState(String(plano?.dependentesPermitidos ?? 0));
  const [quantidadeMensalidades, setQuantidadeMensalidades] = useState(String(plano?.quantidadeMensalidades ?? 12));
  const [diaVencimento, setDiaVencimento] = useState(String(plano?.diaVencimento ?? 10));
  const [regraPrimeiraParcela, setRegraPrimeiraParcela] = useState<RegraPrimeiraParcela>(
    plano?.regraPrimeiraParcela ?? "padrao",
  );
  const [vencimentoNaContratacao, setVencimentoNaContratacao] = useState(plano?.vencimentoNaContratacao ?? false);
  const [beneficios, setBeneficios] = useState(plano?.beneficios.join(", ") ?? "");
  const [ativo, setAtivo] = useState(plano?.ativo ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!nome || !valor) {
      setError("Preencha ao menos nome e valor.");
      return;
    }
    setSaving(true);
    setError("");

    const input = {
      nome,
      valor: Number(valor.replace(",", ".")),
      dependentesPermitidos: Number(dependentesPermitidos) || 0,
      quantidadeMensalidades: Number(quantidadeMensalidades) || 1,
      diaVencimento: Math.min(28, Math.max(1, Number(diaVencimento) || 10)),
      regraPrimeiraParcela,
      vencimentoNaContratacao,
      beneficios: beneficios
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean),
      ativo,
    };

    const result = plano ? await updatePlano(plano.id, input) : await createPlano(input);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader title={plano ? "Editar Plano" : "Novo Plano"} onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          <div>
            <Label required>Nome do plano</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Familiar" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Valor da mensalidade</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Dependentes permitidos</Label>
              <Input
                type="number"
                min={0}
                value={dependentesPermitidos}
                onChange={(e) => setDependentesPermitidos(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Quantidade de mensalidades</Label>
              <Input
                type="number"
                min={1}
                value={quantidadeMensalidades}
                onChange={(e) => setQuantidadeMensalidades(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-gray-400">Quantas parcelas geradas por contrato.</p>
            </div>
            <div>
              <Label required={!vencimentoNaContratacao}>Dia de vencimento</Label>
              <Input
                type="number"
                min={1}
                max={28}
                value={diaVencimento}
                onChange={(e) => setDiaVencimento(e.target.value)}
                disabled={vencimentoNaContratacao}
              />
              <p className="mt-1 text-[11px] text-gray-400">
                {vencimentoNaContratacao ? "Não usado: vale o dia da contratação." : "Entre 1 e 28."}
              </p>
            </div>
          </div>

          <label
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-[6px] border px-3 py-2.5",
              vencimentoNaContratacao ? "border-primary-500 bg-primary-50" : "border-gray-200",
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={vencimentoNaContratacao}
              onChange={(e) => setVencimentoNaContratacao(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-gray-800">Vencer sempre na data da contratação</span>
              <span className="block text-[11px] text-gray-500">
                Todas as parcelas vencem no mesmo dia do mês da contratação. Contratou dia 21/09: 1ª parcela em 21/09, a
                próxima em 21/10, e assim por diante. Em meses mais curtos vence no último dia. O dia de vencimento fixo e
                a regra da primeira parcela deixam de valer.
              </span>
            </span>
          </label>

          <fieldset disabled={vencimentoNaContratacao} className={cn(vencimentoNaContratacao && "opacity-50")}>
            <Label required>Primeira parcela</Label>
            <div className="mt-1.5 space-y-2">
              {(
                [
                  { value: "padrao", label: "Usar vencimento padrão do plano", hint: `A 1ª parcela vence no próximo dia ${diaVencimento} após a adesão, como as demais.` },
                  { value: "adesao", label: "Usar data da adesão", hint: "A 1ª parcela vence na própria data da contratação; as demais seguem o dia padrão." },
                  { value: "manual", label: "Definir manualmente na contratação", hint: "O administrador escolherá a data da 1ª parcela ao vincular o plano ao associado." },
                ] as { value: RegraPrimeiraParcela; label: string; hint: string }[]
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-[6px] border px-3 py-2.5",
                    regraPrimeiraParcela === opt.value ? "border-primary-500 bg-primary-50" : "border-gray-200",
                  )}
                >
                  <input
                    type="radio"
                    name="regraPrimeiraParcela"
                    className="mt-0.5"
                    checked={regraPrimeiraParcela === opt.value}
                    onChange={() => setRegraPrimeiraParcela(opt.value)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-800">{opt.label}</span>
                    <span className="block text-[11px] text-gray-500">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <Label>Benefícios (separados por vírgula)</Label>
            <Textarea value={beneficios} onChange={(e) => setBeneficios(e.target.value)} placeholder="Acesso ilimitado, Estacionamento" />
          </div>

          <div>
            <Label>Status</Label>
            <Select value={ativo ? "true" : "false"} onChange={(e) => setAtivo(e.target.value === "true")}>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </Select>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
            {error}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
