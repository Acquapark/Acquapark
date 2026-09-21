"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CreditCard, Plus, Search, TrendingDown, TrendingUp, Undo2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { Card, KpiCard } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Input, Select } from "@/components/ui/Field";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { Badge, StatusTone } from "@/components/ui/Badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { dataBR, rotuloMes, ultimosMeses } from "@/lib/datas-br";
import type { ContaReceber, Recebimento } from "@/lib/supabase/financeiro";
import { Despesa } from "@/types";
import { RegistrarPagamentoModal, MensalidadeParaBaixa } from "@/components/financeiro/RegistrarPagamentoModal";
import { DespesaModal, PagarDespesaModal } from "@/components/financeiro/DespesaModals";
import { desfazerPagamentoDespesa, excluirDespesa } from "./actions";

type TabKey = "receber" | "recebimentos" | "despesas" | "fluxo";

const ABAS: { key: TabKey; label: string; permissao: string }[] = [
  { key: "receber", label: "Contas a Receber", permissao: "contas_receber.visualizar" },
  { key: "recebimentos", label: "Recebimentos", permissao: "recebimentos.visualizar" },
  { key: "despesas", label: "Despesas", permissao: "despesas.visualizar" },
  { key: "fluxo", label: "Fluxo de Caixa", permissao: "fluxo_caixa.visualizar" },
];

const STATUS_TONE: Record<string, StatusTone> = {
  Pendente: "warning",
  Vencido: "danger",
  "Em processamento": "info",
  Pago: "success",
};

interface LinhaFluxo {
  chave: string;
  entradas: number;
  saidas: number;
}

export function FinanceiroClient({
  mes,
  hoje,
  contas,
  recebimentos,
  despesas,
}: {
  mes: string;
  hoje: string;
  contas: ContaReceber[];
  recebimentos: Recebimento[];
  despesas: Despesa[];
}) {
  const router = useRouter();
  const { pode } = useAcesso();
  const [, startTransition] = useTransition();
  const abasLiberadas = ABAS.filter((a) => pode(a.permissao));
  const [tab, setTab] = useState<TabKey>(abasLiberadas[0]?.key ?? "receber");

  // Contas a receber
  const [filtroConta, setFiltroConta] = useState("Todas");
  const [buscaConta, setBuscaConta] = useState("");
  const [baixando, setBaixando] = useState<MensalidadeParaBaixa | null>(null);

  // Recebimentos
  const [filtroForma, setFiltroForma] = useState("Todas");
  const [filtroTipo, setFiltroTipo] = useState("Todos");

  // Despesas
  const [filtroDespesa, setFiltroDespesa] = useState("Todas");
  const [despesaModalOpen, setDespesaModalOpen] = useState(false);
  const [despesaEditando, setDespesaEditando] = useState<Despesa | null>(null);
  const [despesaModalKey, setDespesaModalKey] = useState(0);
  const [pagando, setPagando] = useState<Despesa | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [despesaSaving, setDespesaSaving] = useState(false);
  const [despesaError, setDespesaError] = useState("");

  const todosPeriodos = mes === "todos";
  const emPeriodo = (data: string) => todosPeriodos || data.startsWith(mes);
  const meses = ultimosMeses(hoje);
  const opcoesMes = meses.includes(mes) || todosPeriodos ? meses : [mes, ...meses];

  function trocarMes(novo: string) {
    startTransition(() => router.push(`/financeiro?mes=${novo}`));
  }

  // --- Totais do período ---
  const receitas = recebimentos.reduce((s, r) => s + r.valor, 0);
  const despesasPagasPeriodo = despesas.filter((d) => d.status === "Pago" && d.pagoEm && emPeriodo(d.pagoEm));
  const totalDespesasPagas = despesasPagasPeriodo.reduce((s, d) => s + d.valor, 0);
  const saldo = receitas - totalDespesasPagas;
  const vencidas = contas.filter((c) => c.status === "Vencido");
  const totalVencido = vencidas.reduce((s, c) => s + c.valor, 0);

  // --- Contas a receber ---
  const contasFiltradas = contas.filter((c) => {
    if (filtroConta === "Vencidas" && c.status !== "Vencido") return false;
    if (filtroConta === "A vencer" && c.status !== "Pendente") return false;
    const termo = buscaConta.trim().toLowerCase();
    return !termo || c.associadoNome.toLowerCase().includes(termo) || c.associadoNumero.includes(termo);
  });
  const totalContasFiltradas = contasFiltradas.reduce((s, c) => s + c.valor, 0);

  // --- Recebimentos ---
  const formasRecebimento = Array.from(new Set(recebimentos.map((r) => r.forma))).sort();
  const recebimentosFiltrados = recebimentos.filter(
    (r) => (filtroForma === "Todas" || r.forma === filtroForma) && (filtroTipo === "Todos" || r.tipo === filtroTipo),
  );
  const totalRecebimentosFiltrados = recebimentosFiltrados.reduce((s, r) => s + r.valor, 0);
  const porForma: Record<string, number> = {};
  for (const r of recebimentosFiltrados) porForma[r.forma] = (porForma[r.forma] ?? 0) + r.valor;

  // --- Despesas ---
  const despesasDoPeriodo = despesas.filter((d) => emPeriodo(d.vencimento) || (d.pagoEm && emPeriodo(d.pagoEm)));
  const despesasFiltradas = despesasDoPeriodo.filter((d) => {
    if (filtroDespesa === "Pendentes") return d.status === "Pendente";
    if (filtroDespesa === "Vencidas") return d.status === "Vencido";
    if (filtroDespesa === "Pagas") return d.status === "Pago";
    return true;
  });
  const totalDespesasFiltradas = despesasFiltradas.reduce((s, d) => s + d.valor, 0);

  // --- Fluxo de caixa ---
  const agrupar = (data: string) => (todosPeriodos ? data.slice(0, 7) : data);
  const mapaFluxo = new Map<string, LinhaFluxo>();
  const linha = (chave: string) => {
    let l = mapaFluxo.get(chave);
    if (!l) {
      l = { chave, entradas: 0, saidas: 0 };
      mapaFluxo.set(chave, l);
    }
    return l;
  };
  for (const r of recebimentos) linha(agrupar(dataBR(r.data))).entradas += r.valor;
  for (const d of despesasPagasPeriodo) linha(agrupar(d.pagoEm as string)).saidas += d.valor;
  const linhasFluxo = Array.from(mapaFluxo.values()).sort((a, b) => a.chave.localeCompare(b.chave));
  let acumulado = 0;
  const fluxoComSaldo = linhasFluxo.map((l) => {
    acumulado += l.entradas - l.saidas;
    return { ...l, acumulado };
  });

  const previstoReceber = contas.filter((c) => emPeriodo(c.vencimento)).reduce((s, c) => s + c.valor, 0);
  const previstoPagar = despesas
    .filter((d) => d.status !== "Pago" && emPeriodo(d.vencimento))
    .reduce((s, d) => s + d.valor, 0);

  function rotuloFluxo(chave: string) {
    return todosPeriodos ? rotuloMes(chave) : formatDate(chave);
  }

  function abrirDespesa(despesa: Despesa | null) {
    setDespesaEditando(despesa);
    setDespesaModalKey((k) => k + 1);
    setDespesaModalOpen(true);
  }

  async function handleExcluir(id: string) {
    setDespesaSaving(true);
    setDespesaError("");
    const result = await excluirDespesa(id);
    setDespesaSaving(false);
    setExcluindoId(null);
    if (result.error) setDespesaError(result.error);
    else router.refresh();
  }

  async function handleDesfazer(id: string) {
    setDespesaSaving(true);
    setDespesaError("");
    const result = await desfazerPagamentoDespesa(id);
    setDespesaSaving(false);
    if (result.error) setDespesaError(result.error);
    else router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Contas a receber, recebimentos, despesas e fluxo de caixa"
        action={
          <div className="flex items-center gap-2">
            <div className="w-52">
              <Select value={mes} onChange={(e) => trocarMes(e.target.value)} aria-label="Período">
                {opcoesMes.map((m) => (
                  <option key={m} value={m}>
                    {rotuloMes(m)}
                  </option>
                ))}
                <option value="todos">Todos os períodos</option>
              </Select>
            </div>
            {tab === "despesas" && pode("despesas.criar") && (
              <Button onClick={() => abrirDespesa(null)}>
                <Plus size={16} />
                Nova Despesa
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Recebido no período" value={formatCurrency(receitas)} icon={TrendingUp} tone="success" />
        <KpiCard label="Despesas pagas" value={formatCurrency(totalDespesasPagas)} icon={TrendingDown} tone="danger" />
        <KpiCard label="Saldo do período" value={formatCurrency(saldo)} icon={Wallet} tone={saldo >= 0 ? "primary" : "danger"} />
        <KpiCard
          label={`Em atraso (${vencidas.length})`}
          value={formatCurrency(totalVencido)}
          icon={AlertTriangle}
          tone={vencidas.length > 0 ? "warning" : "neutral"}
        />
      </div>

      <Card className="mt-5">
        <div className="px-4">
          <Tabs
            tabs={abasLiberadas.map(({ key, label }) => ({ key, label }))}
            active={tab}
            onChange={(k) => setTab(k as TabKey)}
          />
        </div>

        {tab === "receber" && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                <Input className="pl-8" value={buscaConta} onChange={(e) => setBuscaConta(e.target.value)} placeholder="Buscar associado..." />
              </div>
              <div className="w-40">
                <Select value={filtroConta} onChange={(e) => setFiltroConta(e.target.value)}>
                  <option>Todas</option>
                  <option>Vencidas</option>
                  <option>A vencer</option>
                </Select>
              </div>
              <span className="ml-auto text-xs text-gray-500">
                {contasFiltradas.length} conta(s) · <span className="font-medium text-gray-700">{formatCurrency(totalContasFiltradas)}</span> em aberto
              </span>
            </div>
            <Table>
              <Thead>
                <tr>
                  <Th>Associado</Th>
                  <Th>Parcela</Th>
                  <Th>Vencimento</Th>
                  <Th>Valor</Th>
                  <Th>Status</Th>
                  <Th>Ações</Th>
                </tr>
              </Thead>
              <Tbody>
                {contasFiltradas.length === 0 && <TableEmpty colSpan={6} message="Nenhuma conta a receber em aberto." />}
                {contasFiltradas.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <Link href={`/associados/${c.associadoId}`} className="font-medium text-gray-800 hover:text-primary-700 hover:underline">
                        {c.associadoNome}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400">Nº {c.associadoNumero}</span>
                    </Td>
                    <Td>{c.numeroParcela ? `${c.numeroParcela}/${c.totalParcelas}` : "—"}</Td>
                    <Td>{formatDate(c.vencimento)}</Td>
                    <Td>{formatCurrency(c.valor)}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                    </Td>
                    <Td>
                      {pode("contas_receber.receber") && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={c.status === "Em processamento"}
                        title={c.status === "Em processamento" ? "Pagamento em processamento no gateway" : undefined}
                        onClick={() =>
                          setBaixando({
                            id: c.id,
                            associadoId: c.associadoId,
                            vencimento: c.vencimento,
                            valor: c.valor,
                            descricao: `${c.associadoNome}${c.numeroParcela ? ` · parcela ${c.numeroParcela}/${c.totalParcelas}` : ""}`,
                          })
                        }
                      >
                        <CreditCard size={13} />
                        Dar baixa
                      </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </>
        )}

        {tab === "recebimentos" && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
              <div className="w-44">
                <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                  <option value="Todos">Todas as origens</option>
                  <option value="Mensalidade">Mensalidades</option>
                  <option value="Ingresso">Ingressos</option>
                  <option value="Estorno">Estornos</option>
                </Select>
              </div>
              <div className="w-44">
                <Select value={filtroForma} onChange={(e) => setFiltroForma(e.target.value)}>
                  <option value="Todas">Todas as formas</option>
                  {formasRecebimento.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </div>
              <span className="ml-auto text-xs text-gray-500">
                {recebimentosFiltrados.length} lançamento(s) · total{" "}
                <span className="font-medium text-gray-700">{formatCurrency(totalRecebimentosFiltrados)}</span>
              </span>
            </div>
            <Table>
              <Thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Origem</Th>
                  <Th>Valor</Th>
                  <Th>Forma de pagamento</Th>
                  <Th>Responsável</Th>
                </tr>
              </Thead>
              <Tbody>
                {recebimentosFiltrados.length === 0 && <TableEmpty colSpan={5} message="Nenhum recebimento no período." />}
                {recebimentosFiltrados.map((r) => (
                  <Tr key={r.id}>
                    <Td>{formatDateTime(r.data)}</Td>
                    <Td>
                      <span className="mr-2 inline-flex">
                        <Badge tone={r.tipo === "Estorno" ? "danger" : r.tipo === "Mensalidade" ? "info" : "neutral"} dot={false}>
                          {r.tipo}
                        </Badge>
                      </span>
                      {r.origem}
                    </Td>
                    <Td className={r.valor < 0 ? "font-medium text-danger-600" : ""}>{formatCurrency(r.valor)}</Td>
                    <Td>{r.forma}</Td>
                    <Td>{r.responsavel}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            {Object.keys(porForma).length > 0 && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
                {Object.entries(porForma).map(([forma, total]) => (
                  <span key={forma}>
                    {forma}: <span className="font-medium text-gray-700">{formatCurrency(total)}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "despesas" && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
              <div className="w-40">
                <Select value={filtroDespesa} onChange={(e) => setFiltroDespesa(e.target.value)}>
                  <option>Todas</option>
                  <option>Pendentes</option>
                  <option>Vencidas</option>
                  <option>Pagas</option>
                </Select>
              </div>
              <span className="ml-auto text-xs text-gray-500">
                {despesasFiltradas.length} despesa(s) · total{" "}
                <span className="font-medium text-gray-700">{formatCurrency(totalDespesasFiltradas)}</span>
              </span>
            </div>
            {despesaError && (
              <div className="mx-4 mt-3 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
                {despesaError}
              </div>
            )}
            <Table>
              <Thead>
                <tr>
                  <Th>Descrição</Th>
                  <Th>Categoria</Th>
                  <Th>Vencimento</Th>
                  <Th>Valor</Th>
                  <Th>Status</Th>
                  <Th>Pagamento</Th>
                  <Th>Ações</Th>
                </tr>
              </Thead>
              <Tbody>
                {despesasFiltradas.length === 0 && <TableEmpty colSpan={7} message="Nenhuma despesa no período." />}
                {despesasFiltradas.map((d) => (
                  <Tr key={d.id}>
                    <Td>
                      <p className="font-medium text-gray-800">{d.descricao}</p>
                      {d.fornecedor && <p className="text-xs text-gray-400">{d.fornecedor}</p>}
                    </Td>
                    <Td>{d.categoria}</Td>
                    <Td>{formatDate(d.vencimento)}</Td>
                    <Td>{formatCurrency(d.valor)}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge>
                    </Td>
                    <Td>{d.pagoEm ? `${formatDate(d.pagoEm)} · ${d.formaPagamento ?? "—"}` : "—"}</Td>
                    <Td>
                      {excluindoId === d.id ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-danger-600">Excluir?</span>
                          <button
                            onClick={() => handleExcluir(d.id)}
                            disabled={despesaSaving}
                            className="font-semibold text-danger-600 hover:underline disabled:opacity-50"
                          >
                            Sim
                          </button>
                          <button onClick={() => setExcluindoId(null)} className="text-gray-500 hover:underline">
                            Não
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          {d.status !== "Pago" ? (
                            <>
                              {pode("despesas.pagar") && (
                                <Button variant="secondary" size="sm" onClick={() => setPagando(d)}>
                                  Pagar
                                </Button>
                              )}
                              {pode("despesas.editar") && (
                                <Button variant="ghost" size="sm" onClick={() => abrirDespesa(d)}>
                                  Editar
                                </Button>
                              )}
                              {pode("despesas.excluir") && (
                                <Button variant="ghost" size="sm" onClick={() => setExcluindoId(d.id)}>
                                  Excluir
                                </Button>
                              )}
                            </>
                          ) : (
                            pode("despesas.pagar") && (
                              <Button variant="ghost" size="sm" onClick={() => handleDesfazer(d.id)} disabled={despesaSaving}>
                                <Undo2 size={13} />
                                Desfazer pagamento
                              </Button>
                            )
                          )}
                        </div>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </>
        )}

        {tab === "fluxo" && (
          <div className="space-y-5 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="p-4">
                <p className="text-xs text-gray-500">Entradas (recebido)</p>
                <p className="mt-1 text-xl font-semibold text-success-700">{formatCurrency(receitas)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-gray-500">Saídas (despesas pagas)</p>
                <p className="mt-1 text-xl font-semibold text-danger-700">{formatCurrency(totalDespesasPagas)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-gray-500">Saldo realizado</p>
                <p className={`mt-1 text-xl font-semibold ${saldo >= 0 ? "text-primary-700" : "text-danger-700"}`}>
                  {formatCurrency(saldo)}
                </p>
              </Card>
            </div>

            <Table className="rounded-[6px] border border-gray-200">
              <Thead>
                <tr>
                  <Th>{todosPeriodos ? "Mês" : "Dia"}</Th>
                  <Th>Entradas</Th>
                  <Th>Saídas</Th>
                  <Th>Saldo</Th>
                  <Th>Acumulado</Th>
                </tr>
              </Thead>
              <Tbody>
                {fluxoComSaldo.length === 0 && <TableEmpty colSpan={5} message="Sem movimentações no período." />}
                {fluxoComSaldo.map((l) => (
                  <Tr key={l.chave}>
                    <Td className="font-medium text-gray-800">{rotuloFluxo(l.chave)}</Td>
                    <Td className="text-success-700">{formatCurrency(l.entradas)}</Td>
                    <Td className="text-danger-700">{formatCurrency(l.saidas)}</Td>
                    <Td>{formatCurrency(l.entradas - l.saidas)}</Td>
                    <Td className={l.acumulado < 0 ? "font-medium text-danger-600" : "font-medium text-gray-800"}>
                      {formatCurrency(l.acumulado)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
                Previsto ({rotuloMes(mes)}) — ainda não realizado
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="p-4">
                  <p className="text-xs text-gray-500">A receber (mensalidades em aberto)</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(previstoReceber)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-gray-500">A pagar (despesas em aberto)</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(previstoPagar)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-gray-500">Saldo previsto</p>
                  <p
                    className={`mt-1 text-lg font-semibold ${previstoReceber - previstoPagar >= 0 ? "text-primary-700" : "text-danger-700"}`}
                  >
                    {formatCurrency(previstoReceber - previstoPagar)}
                  </p>
                </Card>
              </div>
            </div>
          </div>
        )}
      </Card>

      <RegistrarPagamentoModal key={baixando?.id ?? "baixa"} mensalidade={baixando} onClose={() => setBaixando(null)} />
      <DespesaModal
        key={despesaModalKey}
        open={despesaModalOpen}
        onClose={() => setDespesaModalOpen(false)}
        despesa={despesaEditando}
        hoje={hoje}
      />
      <PagarDespesaModal key={pagando?.id ?? "pagar"} despesa={pagando} onClose={() => setPagando(null)} hoje={hoje} />
    </div>
  );
}
