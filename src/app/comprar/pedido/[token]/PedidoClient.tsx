"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { CheckCircle2, Clock, Copy, CreditCard, Printer, Waves } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { IngressoDoPedido, PedidoOnline } from "@/lib/venda-online/servidor";
import { simularPagamentoPedido } from "../../actions";

/** De quanto em quanto tempo a página confere se o pagamento caiu. */
const INTERVALO_CONFERENCIA_MS = 5000;

function useAgora(ativo: boolean) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ativo]);
  return agora;
}

export function PedidoClient({
  pedido,
  ingressos,
  simulacao,
}: {
  pedido: PedidoOnline;
  ingressos: IngressoDoPedido[];
  simulacao: boolean;
}) {
  const router = useRouter();
  const aguardando = pedido.status === "Aguardando pagamento";
  const agora = useAgora(aguardando);
  const [copiado, setCopiado] = useState(false);
  const [simulando, setSimulando] = useState(false);

  // Enquanto aguarda (ou logo depois de expirar — o Pix ainda pode cair), confere o pagamento sozinho.
  const conferir = aguardando || pedido.status === "Expirado";
  useEffect(() => {
    if (!conferir) return;
    const id = setInterval(() => router.refresh(), INTERVALO_CONFERENCIA_MS);
    return () => clearInterval(id);
  }, [conferir, router]);

  const restanteMs = Math.max(0, new Date(pedido.expiraEm).getTime() - agora);
  const minutos = Math.floor(restanteMs / 60000);
  const segundos = Math.floor((restanteMs % 60000) / 1000);

  async function copiar() {
    if (!pedido.pixCopiaECola) return;
    try {
      await navigator.clipboard.writeText(pedido.pixCopiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Navegador sem permissão de área de transferência: o código está visível para copiar à mão.
    }
  }

  async function simular() {
    setSimulando(true);
    await simularPagamentoPedido(pedido.token);
    setSimulando(false);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="mb-2 flex flex-col items-center print:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-primary-600 text-white shadow-sm">
            <Waves size={24} strokeWidth={2.25} />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-gray-900">Pedido {pedido.numero}</h1>
          <p className="text-sm text-gray-500">Acqua Park</p>
        </div>

        <div className="rounded-[10px] border border-gray-200 bg-white p-5 text-sm shadow-sm print:hidden">
          <div className="flex justify-between">
            <span className="text-gray-500">Data da visita</span>
            <span className="font-medium text-gray-900">{formatDate(pedido.dataUtilizacao)}</span>
          </div>
          {pedido.itens.map((i) => (
            <div key={i.nome} className="mt-1 flex justify-between">
              <span className="text-gray-500">
                {i.quantidade} × {i.nome}
              </span>
              <span className="text-gray-700">{formatCurrency(i.valorUnitario * i.quantidade)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-gray-100 pt-2">
            <span className="font-medium text-gray-700">Total</span>
            <span className="font-bold text-gray-900">{formatCurrency(pedido.valorTotal)}</span>
          </div>
        </div>

        {pedido.status === "Pago" && (
          <>
            <div className="rounded-[10px] border border-success-600/30 bg-success-50 p-4 text-center print:hidden">
              <CheckCircle2 size={32} className="mx-auto text-success-600" />
              <p className="mt-2 font-semibold text-success-700">Pagamento confirmado!</p>
              <p className="mt-1 text-sm text-success-700">
                Apresente o QR Code de cada ingresso na entrada.
                {pedido.emailEnviadoEm && ` Também enviamos este link para ${pedido.compradorEmail}.`}
              </p>
            </div>

            <div className="space-y-4">
              {ingressos.map((ing) => (
                <div
                  key={ing.numero}
                  className="break-inside-avoid rounded-[10px] border border-gray-200 bg-white p-5 text-center shadow-sm print:shadow-none"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Acqua Park</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">{ing.tipo}</p>
                  <p className="text-sm text-gray-600">
                    {ing.semExpiracao ? "Sem data de validade" : `Válido em ${formatDate(ing.dataUtilizacao)}`}
                  </p>
                  <div className="mx-auto mt-3 w-fit rounded-[6px] border border-gray-200 p-2">
                    <QRCodeCanvas value={ing.codigo} size={180} />
                  </div>
                  <p className="mt-2 font-mono text-sm text-gray-700">{ing.codigo}</p>
                  <p className="text-xs text-gray-400">
                    {ing.numero}
                    {ing.status !== "Disponível" && ` · ${ing.status}`}
                  </p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[6px] border border-gray-300 bg-white text-base font-medium text-gray-700 print:hidden"
            >
              <Printer size={18} />
              Imprimir ou salvar em PDF
            </button>
          </>
        )}

        {aguardando && pedido.formaPagamento === "Pix" && pedido.pixCopiaECola && (
          <div className="rounded-[10px] border border-gray-200 bg-white p-5 text-center shadow-sm">
            <p className="font-semibold text-gray-900">Pague com Pix</p>
            <p className="mt-1 text-sm text-gray-500">Escaneie o QR Code no app do seu banco ou use o Pix copia e cola.</p>
            <div className="mx-auto mt-4 w-fit rounded-[6px] border border-gray-200 p-2">
              <QRCodeCanvas value={pedido.pixCopiaECola} size={200} />
            </div>
            <p className="mt-3 break-all rounded-[6px] bg-gray-50 p-2 font-mono text-[11px] text-gray-600">{pedido.pixCopiaECola}</p>
            <button
              type="button"
              onClick={copiar}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-primary-600 text-base font-semibold text-white hover:bg-primary-700"
            >
              <Copy size={18} />
              {copiado ? "Copiado!" : "Copiar código Pix"}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-gray-600">
              <Clock size={14} />
              Pague em até {minutos}:{String(segundos).padStart(2, "0")} — esta página atualiza sozinha.
            </p>
          </div>
        )}

        {aguardando && pedido.formaPagamento === "Cartão de crédito" && pedido.checkoutUrl && (
          <div className="rounded-[10px] border border-gray-200 bg-white p-5 text-center shadow-sm">
            <p className="font-semibold text-gray-900">Pague com cartão de crédito</p>
            <p className="mt-1 text-sm text-gray-500">
              Você vai para a página segura da Asaas. Depois de pagar, volte a esta página: os ingressos aparecem aqui.
            </p>
            <a
              href={pedido.checkoutUrl}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-primary-600 text-base font-semibold text-white hover:bg-primary-700"
            >
              <CreditCard size={18} />
              Pagar {formatCurrency(pedido.valorTotal)}
            </a>
            <p className="mt-3 text-xs text-gray-400">
              Reserva válida por mais {minutos}:{String(segundos).padStart(2, "0")}.
            </p>
          </div>
        )}

        {aguardando && simulacao && (
          <button
            type="button"
            onClick={simular}
            disabled={simulando}
            className="h-11 w-full rounded-[6px] border border-dashed border-warning-600 text-sm font-medium text-warning-700"
          >
            {simulando ? "Simulando..." : "Simular pagamento (modo de teste, sem Asaas)"}
          </button>
        )}

        {pedido.status === "Expirado" && (
          <div className="rounded-[10px] border border-warning-600/30 bg-warning-50 p-5 text-center">
            <p className="font-semibold text-warning-700">O prazo para pagamento terminou</p>
            <p className="mt-1 text-sm text-warning-700">
              Se você já pagou, aguarde: os ingressos aparecem aqui assim que o pagamento for confirmado. Se não pagou, faça um
              novo pedido.
            </p>
            <Link href="/comprar" className="mt-4 inline-flex h-11 items-center rounded-[6px] bg-primary-600 px-5 text-sm font-semibold text-white">
              Fazer nova compra
            </Link>
          </div>
        )}

        {pedido.status === "Cancelado" && (
          <div className="rounded-[10px] border border-gray-200 bg-white p-5 text-center">
            <p className="font-semibold text-gray-800">Pedido cancelado</p>
            <Link href="/comprar" className="mt-4 inline-flex h-11 items-center rounded-[6px] bg-primary-600 px-5 text-sm font-semibold text-white">
              Fazer nova compra
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
