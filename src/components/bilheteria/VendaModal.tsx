"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Infinity as InfinityIcon, Minus, Plus, Tag, X } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Input, Select } from "@/components/ui/Field";
import { cn, formatCurrency } from "@/lib/utils";
import { Ingresso, TipoIngresso } from "@/types";
import { validarCupom, venderIngressos } from "@/app/(app)/bilheteria/actions";
import {
  getAutoPrint,
  getPaperWidth,
  setAutoPrint as saveAutoPrint,
  setPaperWidth as savePaperWidth,
  type PaperWidth,
} from "@/lib/print-ingresso";

const FORMAS_PAGAMENTO = ["Dinheiro", "Pix", "Cartão de débito", "Cartão de crédito"];
const MAX_QUANTIDADE = 50;

function hojeBR() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

interface CupomAplicado {
  codigo: string;
  /** O desconto depende do valor de cada tipo: um resultado por tipo selecionado. */
  porTipo: Record<string, { valorDesconto: number; valorFinal: number }>;
}

interface ItemVenda {
  tipoId: string;
  quantidade: number;
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
  onVendido: (ingressos: Ingresso[]) => void;
}) {
  const router = useRouter();
  const tiposAtivos = tipos.filter((t) => t.ativo);
  // Um ou mais tipos na mesma venda: clique escolhe um, Ctrl + clique adiciona/remove.
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [comprador, setComprador] = useState("");
  const [dataUtilizacao, setDataUtilizacao] = useState(hojeBR());
  const [forma, setForma] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [autoPrint, setAutoPrint] = useState(true);
  const [papel, setPapel] = useState<PaperWidth>("80");

  const [cupomInput, setCupomInput] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<CupomAplicado | null>(null);
  const [cupomChecando, setCupomChecando] = useState(false);
  const [cupomErro, setCupomErro] = useState("");

  useEffect(() => {
    setAutoPrint(getAutoPrint());
    setPapel(getPaperWidth());
  }, []);

  const selecionados = itens
    .map((item) => ({ ...item, tipo: tiposAtivos.find((t) => t.id === item.tipoId) }))
    .filter((item): item is ItemVenda & { tipo: TipoIngresso } => !!item.tipo);
  const quantidade = selecionados.reduce((s, i) => s + i.quantidade, 0);
  const todosSemExpiracao = selecionados.length > 0 && selecionados.every((i) => i.tipo.semExpiracao);

  function alterarQuantidade(tipoId: string, valor: number) {
    const outros = quantidade - (itens.find((i) => i.tipoId === tipoId)?.quantidade ?? 0);
    const limite = Math.max(1, MAX_QUANTIDADE - outros);
    const nova = Math.min(limite, Math.max(1, Math.floor(valor) || 1));
    setItens((atual) => atual.map((i) => (i.tipoId === tipoId ? { ...i, quantidade: nova } : i)));
  }

  function selecionarTipo(id: string, adicionar: boolean) {
    setItens((atual) => {
      const existente = atual.find((i) => i.tipoId === id);
      if (adicionar) {
        // Ctrl + clique: liga/desliga este tipo sem mexer nos outros.
        return existente ? atual.filter((i) => i.tipoId !== id) : [...atual, { tipoId: id, quantidade: 1 }];
      }
      return [{ tipoId: id, quantidade: existente?.quantidade ?? 1 }];
    });
    // O desconto depende do valor dos tipos — mudou a seleção, o cupom precisa ser reaplicado.
    setCupomAplicado(null);
    setCupomErro("");
  }

  async function handleAplicarCupom() {
    if (selecionados.length === 0 || !cupomInput.trim()) return;
    setCupomChecando(true);
    setCupomErro("");
    const porTipo: CupomAplicado["porTipo"] = {};
    for (const item of selecionados) {
      const result = await validarCupom(cupomInput, item.tipo.valor);
      if ("error" in result) {
        setCupomChecando(false);
        setCupomErro(selecionados.length > 1 ? `${item.tipo.nome}: ${result.error}` : result.error);
        setCupomAplicado(null);
        return;
      }
      porTipo[item.tipoId] = { valorDesconto: result.valorDesconto, valorFinal: result.valorFinal };
    }
    setCupomChecando(false);
    setCupomAplicado({ codigo: cupomInput.trim().toUpperCase(), porTipo });
  }

  function removerCupom() {
    setCupomAplicado(null);
    setCupomInput("");
    setCupomErro("");
  }

  async function handleConfirmar() {
    if (selecionados.length === 0) {
      setError("Selecione o tipo de ingresso.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await venderIngressos({
      itens: selecionados.map((i) => ({ tipoId: i.tipoId, quantidade: i.quantidade })),
      comprador,
      dataUtilizacao,
      formaPagamento: forma,
      cupomCodigo: cupomAplicado?.codigo,
    });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
    onVendido(
      result.ingressos.map((i) => ({
        id: i.id,
        numero: i.numero,
        codigo: i.codigo,
        tipo: tiposAtivos.find((t) => t.id === i.tipoId)?.nome ?? "Ingresso",
        comprador: comprador.trim() || "—",
        dataUtilizacao: i.dataUtilizacao,
        semExpiracao: i.semExpiracao,
        valor: i.valor,
        status: "Disponível",
        formaPagamento: forma,
        cupomCodigo: cupomAplicado?.codigo,
        valorDesconto: i.valorDesconto || undefined,
      })),
    );
    onClose();
  }

  const valorUnitario = (item: ItemVenda & { tipo: TipoIngresso }) =>
    cupomAplicado?.porTipo[item.tipoId]?.valorFinal ?? item.tipo.valor;
  const totalFinal = selecionados.reduce((s, i) => s + valorUnitario(i) * i.quantidade, 0);
  const totalSemDesconto = selecionados.reduce((s, i) => s + i.tipo.valor * i.quantidade, 0);

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
              <p className="-mt-1 mb-2 text-[11px] text-gray-400">
                Segure <kbd className="rounded border border-gray-300 bg-gray-50 px-1 font-sans">Ctrl</kbd> e clique para vender mais
                de um tipo na mesma venda.
              </p>
              <div className="grid grid-cols-1 gap-2">
                {tiposAtivos.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={(e) => selecionarTipo(t.id, e.ctrlKey || e.metaKey)}
                    aria-pressed={itens.some((i) => i.tipoId === t.id)}
                    className={cn(
                      "flex items-center justify-between rounded-[6px] border px-3 py-2.5 text-left transition-colors",
                      itens.some((i) => i.tipoId === t.id) ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:border-gray-300",
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

            {selecionados.length > 0 && (
              <div>
                <Label required>Quantidade de ingressos</Label>
                <div className="space-y-2">
                  {selecionados.map((item) => (
                    <div key={item.tipoId} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm text-gray-700">{item.tipo.nome}</span>
                      <div className="flex w-40 shrink-0 items-center gap-1.5">
                        <Button
                          variant="secondary"
                          onClick={() => alterarQuantidade(item.tipoId, item.quantidade - 1)}
                          disabled={item.quantidade <= 1}
                          aria-label={`Diminuir quantidade de ${item.tipo.nome}`}
                        >
                          <Minus size={14} />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          max={MAX_QUANTIDADE}
                          value={item.quantidade}
                          onChange={(e) => alterarQuantidade(item.tipoId, Number(e.target.value))}
                          className="text-center"
                          aria-label={`Quantidade de ${item.tipo.nome}`}
                        />
                        <Button
                          variant="secondary"
                          onClick={() => alterarQuantidade(item.tipoId, item.quantidade + 1)}
                          disabled={quantidade >= MAX_QUANTIDADE}
                          aria-label={`Aumentar quantidade de ${item.tipo.nome}`}
                        >
                          <Plus size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Nome do comprador</Label>
              <Input value={comprador} onChange={(e) => setComprador(e.target.value)} placeholder="Opcional" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                {todosSemExpiracao ? (
                  <>
                    <Label>Validade</Label>
                    <div className="flex h-9 items-center gap-1.5 rounded-[4px] border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600">
                      <InfinityIcon size={14} />
                      Sem expiração
                    </div>
                  </>
                ) : (
                  <>
                    <Label required>Data de utilização</Label>
                    <Input type="date" min={hojeBR()} value={dataUtilizacao} onChange={(e) => setDataUtilizacao(e.target.value)} />
                  </>
                )}
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

            <div>
              <Label>Cupom de desconto</Label>
              {cupomAplicado ? (
                <div className="flex items-center justify-between rounded-[6px] border border-success-600/30 bg-success-50 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-success-700">
                    <Tag size={14} />
                    {cupomAplicado.codigo} · -{formatCurrency(totalSemDesconto - totalFinal)}
                  </span>
                  <button type="button" onClick={removerCupom} className="text-success-700 hover:text-success-900">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={cupomInput}
                    onChange={(e) => {
                      setCupomInput(e.target.value.toUpperCase());
                      setCupomErro("");
                    }}
                    placeholder="Código (opcional)"
                    className="uppercase"
                    disabled={selecionados.length === 0}
                  />
                  <Button variant="secondary" onClick={handleAplicarCupom} disabled={selecionados.length === 0 || !cupomInput.trim() || cupomChecando}>
                    {cupomChecando ? "Checando..." : "Aplicar"}
                  </Button>
                </div>
              )}
              {cupomErro && <p className="mt-1 text-xs text-danger-600">{cupomErro}</p>}
              {selecionados.length === 0 && (
                <p className="mt-1 text-[11px] text-gray-400">Selecione o tipo de ingresso antes de aplicar um cupom.</p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-[6px] border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="text-sm text-gray-600">
                Total a receber
                {quantidade > 1 &&
                  selecionados.map((i) => (
                    <span key={i.tipoId} className="block text-[11px] text-gray-400">
                      {i.quantidade} × {i.tipo.nome} ({formatCurrency(valorUnitario(i))})
                    </span>
                  ))}
              </span>
              <span className="flex items-baseline gap-2">
                {cupomAplicado && (
                  <span className="text-xs text-gray-400 line-through">{formatCurrency(totalSemDesconto)}</span>
                )}
                <span className="text-lg font-semibold text-gray-900">{formatCurrency(totalFinal)}</span>
              </span>
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
            {saving ? "Emitindo..." : quantidade > 1 ? `Confirmar recebimento e emitir ${quantidade} ingressos` : "Confirmar recebimento e emitir"}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
