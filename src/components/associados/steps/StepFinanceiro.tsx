"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Pencil, QrCode, Receipt, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { StatusBadge, StatusMaps } from "@/components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Mensalidade } from "@/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { RegistrarPagamentoModal } from "@/components/financeiro/RegistrarPagamentoModal";
import { CobrarModal, MensalidadeParaCobranca } from "@/components/financeiro/CobrarModal";
import { alterarVencimentoMensalidade, cancelarMensalidade, sincronizarMensalidade } from "@/app/(app)/financeiro/actions";

const EDITAVEL = new Set(["Pendente", "Vencido", "Em processamento"]);

export function StepFinanceiro({
  mensalidades,
  associadoId,
}: {
  mensalidades: Mensalidade[];
  associadoId?: string;
}) {
  const router = useRouter();
  const { pode } = useAcesso();
  const pagas = mensalidades.filter((m) => m.status === "Pago");
  const [registrando, setRegistrando] = useState<Mensalidade | null>(null);
  const [cobrando, setCobrando] = useState<MensalidadeParaCobranca | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novoVencimento, setNovoVencimento] = useState("");
  const [salvandoVencimento, setSalvandoVencimento] = useState(false);
  const [erroVencimento, setErroVencimento] = useState("");

  const [cancelando, setCancelando] = useState<Mensalidade | null>(null);
  const [cancelandoBusy, setCancelandoBusy] = useState(false);
  const [erroCancelar, setErroCancelar] = useState("");

  const [sincronizandoId, setSincronizandoId] = useState<string | null>(null);

  function iniciarEdicaoVencimento(m: Mensalidade) {
    if (!pode("contas_receber.editar") || !EDITAVEL.has(m.status)) return;
    setErroVencimento("");
    setNovoVencimento(m.vencimento);
    setEditandoId(m.id);
  }

  async function salvarVencimento(mensalidadeId: string) {
    setSalvandoVencimento(true);
    setErroVencimento("");
    const result = await alterarVencimentoMensalidade(mensalidadeId, novoVencimento);
    setSalvandoVencimento(false);
    if ("error" in result) {
      setErroVencimento(result.error);
      return;
    }
    setEditandoId(null);
    router.refresh();
  }

  async function handleConfirmarCancelamento() {
    if (!cancelando) return;
    setCancelandoBusy(true);
    setErroCancelar("");
    const result = await cancelarMensalidade(cancelando.id);
    setCancelandoBusy(false);
    if ("error" in result) {
      setErroCancelar(result.error);
      return;
    }
    setCancelando(null);
    router.refresh();
  }

  async function handleSincronizar(mensalidadeId: string) {
    setSincronizandoId(mensalidadeId);
    await sincronizarMensalidade(mensalidadeId);
    setSincronizandoId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Mensalidades</p>
        <Table className="rounded-[6px] border border-gray-200">
          <Thead>
            <tr>
              <Th>Vencimento</Th>
              <Th>Valor</Th>
              <Th>Status</Th>
              <Th>Status Asaas</Th>
              <Th>Pagamento</Th>
              <Th>Ações</Th>
            </tr>
          </Thead>
          <Tbody>
            {mensalidades.length === 0 && (
              <TableEmpty colSpan={6} message="Nenhuma mensalidade gerada ainda. Será criada após salvar o cadastro." />
            )}
            {mensalidades.map((m) => (
              <Tr key={m.id}>
                <Td>
                  {editandoId === m.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="date"
                        value={novoVencimento}
                        onChange={(e) => setNovoVencimento(e.target.value)}
                        className="h-7 w-36 px-1.5 text-xs"
                        autoFocus
                        disabled={salvandoVencimento}
                      />
                      <button
                        onClick={() => salvarVencimento(m.id)}
                        disabled={salvandoVencimento}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-40"
                      >
                        {salvandoVencimento ? "..." : "Salvar"}
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        disabled={salvandoVencimento}
                        className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <span
                      onDoubleClick={() => iniciarEdicaoVencimento(m)}
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        EDITAVEL.has(m.status) && pode("contas_receber.editar") && "cursor-pointer",
                      )}
                    >
                      {formatDate(m.vencimento)}
                      {EDITAVEL.has(m.status) && pode("contas_receber.editar") && (
                        <Pencil size={11} className="text-gray-300" />
                      )}
                    </span>
                  )}
                </Td>
                <Td>{formatCurrency(m.valor)}</Td>
                <Td>
                  <StatusBadge status={m.status} map={StatusMaps.mensalidade} />
                </Td>
                <Td>
                  {m.asaasSyncError ? (
                    <span className="text-xs text-danger-600" title={m.asaasSyncError}>
                      Erro de sincronização
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">{m.asaasStatus ?? "—"}</span>
                  )}
                </Td>
                <Td>{m.pagamentoEm ? formatDate(m.pagamentoEm) : "—"}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {m.status !== "Pago" && pode("contas_receber.receber") && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setRegistrando(m)}
                        disabled={!associadoId}
                      >
                        <CreditCard size={13} />
                        Registrar
                      </Button>
                    )}
                    {m.status === "Pendente" && pode("contas_receber.receber") && (
                      <Button variant="ghost" size="sm" onClick={() => setCobrando({ id: m.id, vencimento: m.vencimento, valor: m.valor })}>
                        <QrCode size={13} />
                        Cobrar
                      </Button>
                    )}
                    {(m.asaasSyncError || (!m.gatewayChargeId && EDITAVEL.has(m.status))) && pode("contas_receber.criar") && (
                      <Button variant="ghost" size="sm" onClick={() => handleSincronizar(m.id)} disabled={sincronizandoId === m.id}>
                        <RefreshCw size={13} />
                        {sincronizandoId === m.id ? "Sincronizando..." : "Sincronizar"}
                      </Button>
                    )}
                    {EDITAVEL.has(m.status) && pode("contas_receber.cancelar") && (
                      <Button variant="ghost" size="sm" onClick={() => setCancelando(m)}>
                        <XCircle size={13} />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        {erroVencimento && <p className="mt-1.5 text-xs text-danger-600">{erroVencimento}</p>}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Receipt size={15} className="text-gray-400" />
          Histórico de pagamentos
        </p>
        <Table className="rounded-[6px] border border-gray-200">
          <Thead>
            <tr>
              <Th>Data</Th>
              <Th>Valor</Th>
              <Th>Forma</Th>
              <Th>Referência</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {pagas.length === 0 && <TableEmpty colSpan={5} message="Sem pagamentos registrados." />}
            {pagas.map((m) => (
              <Tr key={m.id}>
                <Td>{m.pagamentoEm ? formatDate(m.pagamentoEm) : "—"}</Td>
                <Td>{formatCurrency(m.valor)}</Td>
                <Td>{m.formaPagamento}</Td>
                <Td>REF-{m.id.toUpperCase()}</Td>
                <Td>
                  <StatusBadge status={m.status} map={StatusMaps.mensalidade} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      <RegistrarPagamentoModal
        mensalidade={
          registrando && associadoId
            ? { id: registrando.id, associadoId, vencimento: registrando.vencimento, valor: registrando.valor }
            : null
        }
        onClose={() => setRegistrando(null)}
      />
      <CobrarModal mensalidade={cobrando} onClose={() => setCobrando(null)} />

      <Modal open={!!cancelando} onClose={() => setCancelando(null)} size="md">
        <ModalHeader title="Cancelar mensalidade?" onClose={() => setCancelando(null)} />
        <ModalBody>
          {cancelando && (
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                Parcela {cancelando.numeroParcela ?? "—"}/{cancelando.totalParcelas ?? "—"} — {formatCurrency(cancelando.valor)} —
                vencimento {formatDate(cancelando.vencimento)}.
              </p>
              <p className="text-xs text-gray-500">
                {cancelando.gatewayChargeId
                  ? "Esta ação também cancela a cobrança correspondente no Asaas."
                  : "Esta mensalidade não tem cobrança criada no Asaas — só o registro local será cancelado."}
              </p>
              {erroCancelar && <p className="text-xs text-danger-600">{erroCancelar}</p>}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setCancelando(null)} disabled={cancelandoBusy}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={handleConfirmarCancelamento} disabled={cancelandoBusy}>
            {cancelandoBusy ? "Cancelando..." : "Cancelar mensalidade"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
