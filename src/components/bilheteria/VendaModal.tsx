"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Input, Select } from "@/components/ui/Field";
import { cn, formatCurrency } from "@/lib/utils";
import { Ingresso, TipoIngresso } from "@/types";
import { venderIngresso } from "@/app/(app)/bilheteria/actions";
import {
  getAutoPrint,
  getPaperWidth,
  setAutoPrint as saveAutoPrint,
  setPaperWidth as savePaperWidth,
  type PaperWidth,
} from "@/lib/print-ingresso";

const FORMAS_PAGAMENTO = ["Dinheiro", "Pix", "Cartão de débito", "Cartão de crédito"];

function hojeBR() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function VendaModal({
  open,
  onClose,
  tipos,
  onVendido,
}: {
  open: boolean;
  onClose: () => void;
  tipos: TipoIngresso[];
  onVendido: (ingresso: Ingresso) => void;
}) {
  const router = useRouter();
  const tiposAtivos = tipos.filter((t) => t.ativo);
  const [tipoId, setTipoId] = useState("");
  const [comprador, setComprador] = useState("");
  const [dataUtilizacao, setDataUtilizacao] = useState(hojeBR());
  const [forma, setForma] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [autoPrint, setAutoPrint] = useState(true);
  const [papel, setPapel] = useState<PaperWidth>("80");

  useEffect(() => {
    setAutoPrint(getAutoPrint());
    setPapel(getPaperWidth());
  }, []);

  const tipo = tiposAtivos.find((t) => t.id === tipoId);

  async function handleConfirmar() {
    if (!tipo) {
      setError("Selecione o tipo de ingresso.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await venderIngresso({ tipoId, comprador, dataUtilizacao, formaPagamento: forma });
    setSaving(false);
    if (result.error || !result.ingresso) {
      setError(result.error ?? "Não foi possível emitir o ingresso.");
      return;
    }
    router.refresh();
    onVendido({
      id: result.ingresso.id,
      numero: result.ingresso.numero,
      codigo: result.ingresso.codigo,
      tipo: tipo.nome,
      comprador: comprador.trim(),
      dataUtilizacao,
      valor: tipo.valor,
      status: "Disponível",
      formaPagamento: forma,
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader title="Nova venda de ingresso" onClose={onClose} />
      <ModalBody>
        {tiposAtivos.length === 0 ? (
          <p className="text-sm text-gray-500">
            Não há tipos de ingresso ativos. Cadastre ou ative um tipo na aba &quot;Tipos de Ingresso&quot; para vender.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label required>Tipo de ingresso</Label>
              <div className="grid grid-cols-1 gap-2">
                {tiposAtivos.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTipoId(t.id)}
                    className={cn(
                      "flex items-center justify-between rounded-[6px] border px-3 py-2.5 text-left transition-colors",
                      tipoId === t.id ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300",
                    )}
                  >
                    <span>
                      <span className="block text-sm font-medium text-gray-800">{t.nome}</span>
                      {t.descricao && <span className="block text-[11px] text-gray-500">{t.descricao}</span>}
                    </span>
                    <span className="ml-3 shrink-0 text-sm font-semibold text-gray-900">{formatCurrency(t.valor)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label required>Nome do comprador</Label>
              <Input value={comprador} onChange={(e) => setComprador(e.target.value)} placeholder="Nome completo" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Data de utilização</Label>
                <Input type="date" min={hojeBR()} value={dataUtilizacao} onChange={(e) => setDataUtilizacao(e.target.value)} />
              </div>
              <div>
                <Label required>Forma de pagamento</Label>
                <Select value={forma} onChange={(e) => setForma(e.target.value)}>
                  <option value="">Selecione</option>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[6px] border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="text-sm text-gray-600">Total a receber</span>
              <span className="text-lg font-semibold text-gray-900">{formatCurrency(tipo?.valor ?? 0)}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => {
                    setAutoPrint(e.target.checked);
                    saveAutoPrint(e.target.checked);
                  }}
                />
                Imprimir ingresso ao confirmar
              </label>
              <label className="flex items-center gap-2">
                Papel
                <select
                  value={papel}
                  onChange={(e) => {
                    const value = e.target.value as PaperWidth;
                    setPapel(value);
                    savePaperWidth(value);
                  }}
                  className="h-8 rounded-[4px] border border-gray-300 bg-white px-2 text-sm"
                >
                  <option value="80">80 mm</option>
                  <option value="58">58 mm</option>
                </select>
              </label>
            </div>
          </div>
        )}

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
        {tiposAtivos.length > 0 && (
          <Button onClick={handleConfirmar} disabled={saving}>
            {saving ? "Emitindo..." : "Confirmar recebimento e emitir"}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
