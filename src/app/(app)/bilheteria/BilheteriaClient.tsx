"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Plus, Printer, RotateCcw, Search, Ticket as TicketIcon, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Input, Select } from "@/components/ui/Field";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { StatusBadge, StatusMaps } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CupomDesconto, Ingresso, IngressoStatus, TipoIngresso } from "@/types";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { TiposIngressoManager } from "@/components/bilheteria/TiposIngressoManager";
import { CupomManager } from "@/components/bilheteria/CupomManager";
import { VendaModal } from "@/components/bilheteria/VendaModal";
import { IngressoQrModal } from "@/components/bilheteria/IngressoQrModal";
import { getAutoPrint, imprimirIngresso } from "@/lib/print-ingresso";
import { cancelarIngresso, excluirIngresso, reativarIngresso } from "./actions";

const STATUS_OPTIONS: IngressoStatus[] = ["Disponível", "Utilizado", "Cancelado", "Expirado"];

function hojeBR() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function BilheteriaClient({
  ingressos,
  tipos,
  cupons,
  periodo,
  caixa,
}: {
  ingressos: Ingresso[];
  tipos: TipoIngresso[];
  cupons: CupomDesconto[];
  periodo: { de: string; ate: string };
  caixa: { numero: string; operadorNome: string } | null;
}) {
  const caixaAberto = caixa !== null;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { pode } = useAcesso();
  const [tab, setTab] = useState<"ingressos" | "tipos" | "cupons">("ingressos");
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("Todos");
  const [de, setDe] = useState(periodo.de);
  const [ate, setAte] = useState(periodo.ate);

  function aplicarPeriodo(novoDe: string, novoAte: string) {
    setDe(novoDe);
    setAte(novoAte);
    startTransition(() => router.push(`/bilheteria?de=${novoDe}&ate=${novoAte}`));
  }

  function irParaHoje() {
    aplicarPeriodo(hojeBR(), hojeBR());
  }

  // Atualiza a lista sozinha enquanto a aba "Ingressos" está aberta — sem
  // isso, um ingresso validado na catraca (por um processo totalmente à
  // parte, fora do Next.js) só aparecia como "Utilizado" depois de sair e
  // voltar pra essa página.
  useEffect(() => {
    if (tab !== "ingressos") return;
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [tab, router]);

  const [vendaOpen, setVendaOpen] = useState(false);
  const [vendaKey, setVendaKey] = useState(0);
  const [qrIngresso, setQrIngresso] = useState<Ingresso | null>(null);
  const [qrTitle, setQrTitle] = useState("QR Code do ingresso");

  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [cancelSaving, setCancelSaving] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [excluirSaving, setExcluirSaving] = useState(false);
  const [reativandoId, setReativandoId] = useState<string | null>(null);
  const [reativarSaving, setReativarSaving] = useState(false);
  const [error, setError] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = ingressos.filter((i) => {
    if (statusFiltro !== "Todos" && i.status !== statusFiltro) return false;
    if (!termo) return true;
    return i.numero.toLowerCase().includes(termo) || i.comprador.toLowerCase().includes(termo);
  });

  function openVenda() {
    setVendaKey((k) => k + 1);
    setVendaOpen(true);
  }

  function handleVendido(ingresso: Ingresso) {
    setQrTitle("Ingresso emitido com sucesso");
    setQrIngresso(ingresso);
    if (getAutoPrint()) imprimirIngresso(ingresso.id);
  }

  function openQr(ingresso: Ingresso) {
    setQrTitle("QR Code do ingresso");
    setQrIngresso(ingresso);
  }

  async function handleConfirmCancel(id: string) {
    setCancelSaving(true);
    setError("");
    const result = await cancelarIngresso(id);
    setCancelSaving(false);
    setCancelandoId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleConfirmExcluir(id: string) {
    setExcluirSaving(true);
    setError("");
    const result = await excluirIngresso(id);
    setExcluirSaving(false);
    setExcluindoId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleConfirmReativar(id: string) {
    setReativarSaving(true);
    setError("");
    const result = await reativarIngresso(id);
    setReativarSaving(false);
    setReativandoId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Bilheteria"
        subtitle="Venda de ingressos avulsos e gestão de tipos de ingresso"
        action={
          pode("ingressos.criar") ? (
            <Button onClick={openVenda} disabled={!caixaAberto} title={caixaAberto ? undefined : "Abra o caixa para vender"}>
              <Plus size={16} />
              Nova Venda
            </Button>
          ) : undefined
        }
      />

      {caixaAberto ? (
        <p className="mb-3 text-xs text-gray-500">
          Vendas lançadas no caixa <span className="font-medium text-gray-700">{caixa?.numero}</span> · operador{" "}
          <span className="font-medium text-gray-700">{caixa?.operadorNome}</span>.
        </p>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[6px] border border-warning-600/30 bg-warning-50 px-4 py-3">
          <Lock size={16} className="text-warning-700" />
          <p className="text-sm text-warning-700">
            <span className="font-semibold">Caixa fechado.</span> Abra o caixa para realizar vendas e cancelamentos.
          </p>
          <Link href="/caixa" className="ml-auto text-sm font-semibold text-warning-700 underline">
            Ir para o Caixa
          </Link>
        </div>
      )}

      <Card>
        <div className="px-4">
          <Tabs
            tabs={[
              { key: "ingressos", label: "Ingressos" },
              ...(pode("tipos_ingresso.visualizar") ? [{ key: "tipos", label: "Tipos de Ingresso" }] : []),
              ...(pode("cupons_desconto.visualizar") ? [{ key: "cupons", label: "Cupons de Desconto" }] : []),
            ]}
            active={tab}
            onChange={(k) => setTab(k as "ingressos" | "tipos" | "cupons")}
          />
        </div>

        {tab === "ingressos" ? (
          <>
            <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 p-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500">De</label>
                <Input type="date" className="w-36" value={de} onChange={(e) => aplicarPeriodo(e.target.value, ate)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500">Até</label>
                <Input type="date" className="w-36" value={ate} onChange={(e) => aplicarPeriodo(de, e.target.value)} />
              </div>
              <Button variant="secondary" size="sm" onClick={irParaHoje}>
                Hoje
              </Button>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-8"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por número ou comprador..."
                />
              </div>
              <div className="w-44">
                <Select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
                  <option value="Todos">Todos os status</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <span className="ml-auto text-xs text-gray-400">
                {filtrados.length} ingresso(s) · venda de {formatDate(de)}
                {ate !== de ? ` a ${formatDate(ate)}` : ""}
              </span>
            </div>

            {error && (
              <div className="mx-4 mt-3 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
                {error}
              </div>
            )}

            <Table>
              <Thead>
                <tr>
                  <Th>Número</Th>
                  <Th>Tipo</Th>
                  <Th>Comprador</Th>
                  <Th>Data de utilização</Th>
                  <Th>Valor</Th>
                  <Th>Cupom</Th>
                  <Th>Pagamento</Th>
                  <Th>Status</Th>
                  <Th>Ações</Th>
                </tr>
              </Thead>
              <Tbody>
                {filtrados.length === 0 && (
                  <TableEmpty
                    colSpan={9}
                    message={ingressos.length === 0 ? "Nenhum ingresso emitido nesse período." : "Nenhum ingresso encontrado."}
                  />
                )}
                {filtrados.map((i) => (
                  <Tr key={i.id}>
                    <Td>
                      <div className="flex items-center gap-1.5 font-medium text-gray-800">
                        <TicketIcon size={13} className="text-gray-400" />
                        {i.numero}
                      </div>
                    </Td>
                    <Td>{i.tipo}</Td>
                    <Td>{i.comprador}</Td>
                    <Td>{formatDate(i.dataUtilizacao)}</Td>
                    <Td>{formatCurrency(i.valor)}</Td>
                    <Td>
                      {i.cupomCodigo ? (
                        <span title={i.valorDesconto ? `Desconto de ${formatCurrency(i.valorDesconto)}` : undefined}>
                          {i.cupomCodigo}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>{i.formaPagamento ?? "—"}</Td>
                    <Td>
                      <StatusBadge status={i.status} map={StatusMaps.ingresso} />
                    </Td>
                    <Td>
                      {cancelandoId === i.id ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-danger-600">Cancelar?</span>
                          <button
                            onClick={() => handleConfirmCancel(i.id)}
                            disabled={cancelSaving}
                            className="font-semibold text-danger-600 hover:underline disabled:opacity-50"
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setCancelandoId(null)}
                            disabled={cancelSaving}
                            className="text-gray-500 hover:underline"
                          >
                            Não
                          </button>
                        </div>
                      ) : excluindoId === i.id ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-danger-600">Excluir venda?</span>
                          <button
                            onClick={() => handleConfirmExcluir(i.id)}
                            disabled={excluirSaving}
                            className="font-semibold text-danger-600 hover:underline disabled:opacity-50"
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setExcluindoId(null)}
                            disabled={excluirSaving}
                            className="text-gray-500 hover:underline"
                          >
                            Não
                          </button>
                        </div>
                      ) : reativandoId === i.id ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-primary-700">Voltar a Disponível?</span>
                          <button
                            onClick={() => handleConfirmReativar(i.id)}
                            disabled={reativarSaving}
                            className="font-semibold text-primary-700 hover:underline disabled:opacity-50"
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setReativandoId(null)}
                            disabled={reativarSaving}
                            className="text-gray-500 hover:underline"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => openQr(i)}>
                            QR Code
                          </Button>
                          {i.status !== "Cancelado" && pode("ingressos.imprimir") && (
                            <Button variant="secondary" size="sm" onClick={() => imprimirIngresso(i.id)}>
                              <Printer size={13} />
                              Imprimir
                            </Button>
                          )}
                          {i.status === "Disponível" && pode("ingressos.cancelar") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCancelandoId(i.id)}
                              disabled={!caixaAberto}
                              title={caixaAberto ? undefined : "Abra o caixa para cancelar (o estorno sai do caixa)"}
                            >
                              Cancelar
                            </Button>
                          )}
                          {pode("ingressos.excluir") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExcluindoId(i.id)}
                              title="Apaga a venda de vez, como se nunca tivesse acontecido"
                            >
                              <Trash2 size={13} />
                              Excluir
                            </Button>
                          )}
                          {i.status !== "Disponível" && pode("ingressos.reativar") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReativandoId(i.id)}
                              title="Volta o ingresso pra Disponível, como se não tivesse sido usado/cancelado"
                            >
                              <RotateCcw size={13} />
                              Reativar
                            </Button>
                          )}
                        </div>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </>
        ) : tab === "tipos" ? (
          <div className="p-4">
            <TiposIngressoManager tipos={tipos} />
          </div>
        ) : (
          <div className="p-4">
            <CupomManager cupons={cupons} />
          </div>
        )}
      </Card>

      <VendaModal key={vendaKey} open={vendaOpen} onClose={() => setVendaOpen(false)} tipos={tipos} onVendido={handleVendido} />
      <IngressoQrModal open={!!qrIngresso} onClose={() => setQrIngresso(null)} ingresso={qrIngresso} title={qrTitle} />
    </div>
  );
}
