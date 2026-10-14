"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ExternalLink, Mail, Search } from "lucide-react";
import { Badge, StatusTone } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { useAcesso } from "@/components/providers/AcessoProvider";
import type { PedidoOnline } from "@/lib/venda-online/servidor";
import { reenviarEmailPedidoOnline, remarcarPedidoOnline } from "@/app/(app)/bilheteria/actions";
import { RemarcarModal } from "./RemarcarModal";

const TOM: Record<PedidoOnline["status"], StatusTone> = {
  Pago: "success",
  "Aguardando pagamento": "warning",
  Expirado: "neutral",
  Cancelado: "neutral",
};

export function VendasOnlineTab({ pedidos }: { pedidos: PedidoOnline[] }) {
  const { pode } = useAcesso();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("Todos");
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [remarcando, setRemarcando] = useState<PedidoOnline | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pedidos.filter(
      (p) =>
        (status === "Todos" || p.status === status) &&
        (!termo ||
          p.numero.toLowerCase().includes(termo) ||
          p.compradorNome.toLowerCase().includes(termo) ||
          p.compradorEmail.includes(termo) ||
          p.compradorCpf.replace(/\D/g, "").includes(termo.replace(/\D/g, "") || "#")),
    );
  }, [pedidos, busca, status]);

  const pagos = pedidos.filter((p) => p.status === "Pago");
  const totalPago = pagos.reduce((s, p) => s + p.valorTotal, 0);

  async function reenviar(p: PedidoOnline) {
    setEnviandoId(p.id);
    setAviso(null);
    const result = await reenviarEmailPedidoOnline(p.id);
    setEnviandoId(null);
    setAviso("error" in result ? { tipo: "erro", texto: result.error } : { tipo: "ok", texto: `E-mail reenviado para ${p.compradorEmail}.` });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <Input className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pedido, nome, e-mail ou CPF..." />
        </div>
        <div className="w-48">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Todos</option>
            <option>Pago</option>
            <option>Aguardando pagamento</option>
            <option>Expirado</option>
            <option>Cancelado</option>
          </Select>
        </div>
        <span className="ml-auto text-xs text-gray-500">
          {pagos.length} pedido(s) pago(s) · <span className="font-medium text-gray-700">{formatCurrency(totalPago)}</span> (últimos{" "}
          {pedidos.length})
        </span>
      </div>

      {aviso && (
        <div
          className={`mx-4 mt-3 rounded-[4px] border px-3 py-2 text-xs ${
            aviso.tipo === "ok" ? "border-success-600/30 bg-success-50 text-success-700" : "border-danger-600/30 bg-danger-50 text-danger-700"
          }`}
        >
          {aviso.texto}
        </div>
      )}

      <Table>
        <Thead>
          <tr>
            <Th>Pedido</Th>
            <Th>Comprador</Th>
            <Th>Visita</Th>
            <Th>Ingressos</Th>
            <Th>Total</Th>
            <Th>Status</Th>
            <Th>Ações</Th>
          </tr>
        </Thead>
        <Tbody>
          {filtrados.length === 0 && <TableEmpty colSpan={7} message="Nenhum pedido online." />}
          {filtrados.map((p) => (
            <Tr key={p.id}>
              <Td>
                <p className="font-medium text-gray-800">{p.numero}</p>
                <p className="text-xs text-gray-400">{formatDateTime(p.criadoEm)}</p>
              </Td>
              <Td>
                <p className="text-gray-800">{p.compradorNome}</p>
                <p className="text-xs text-gray-400">
                  {p.compradorEmail} · {p.compradorTelefone}
                </p>
              </Td>
              <Td>{formatDate(p.dataUtilizacao)}</Td>
              <Td>
                <span title={p.itens.map((i) => `${i.quantidade} × ${i.nome}`).join("\n")}>{p.quantidade}</span>
              </Td>
              <Td>
                {formatCurrency(p.valorTotal)}
                <p className="text-xs text-gray-400">{p.formaPagamento}</p>
              </Td>
              <Td>
                <Badge tone={TOM[p.status]}>{p.status}</Badge>
              </Td>
              <Td>
                <div className="flex items-center gap-1">
                  <a
                    href={`/comprar/pedido/${p.token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[4px] p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary-600"
                    title="Abrir a página do pedido (com os QR Codes)"
                  >
                    <ExternalLink size={14} />
                  </a>
                  {p.status === "Pago" && pode("ingressos.alterar_data") && (
                    <button
                      type="button"
                      onClick={() => setRemarcando(p)}
                      className="rounded-[4px] p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary-600"
                      title="Remarcar o pedido (muda a data de todos os ingressos não usados)"
                    >
                      <CalendarClock size={14} />
                    </button>
                  )}
                  {p.status === "Pago" && pode("ingressos.criar") && (
                    <button
                      type="button"
                      onClick={() => reenviar(p)}
                      disabled={enviandoId === p.id}
                      className="rounded-[4px] p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary-600 disabled:opacity-50"
                      title={p.emailEnviadoEm ? `E-mail enviado em ${formatDateTime(p.emailEnviadoEm)} — reenviar` : "Enviar e-mail"}
                    >
                      <Mail size={14} />
                    </button>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {remarcando && (
        <RemarcarModal
          open
          onClose={() => setRemarcando(null)}
          titulo={`Remarcar pedido ${remarcando.numero}`}
          dataAtual={remarcando.dataUtilizacao}
          descricao={
            <p>
              {remarcando.compradorNome} · {remarcando.quantidade} ingresso(s) para{" "}
              <strong>{formatDate(remarcando.dataUtilizacao)}</strong>. Os ingressos ainda não usados vão para a nova data e o
              comprador recebe um e-mail.
            </p>
          }
          onConfirmar={(novaData, motivo) => remarcarPedidoOnline({ pedidoId: remarcando.id, novaData, motivo })}
        />
      )}
    </>
  );
}
