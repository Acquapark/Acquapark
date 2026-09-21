"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Barcode, Check, ClipboardCopy, CreditCard, QrCode, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FormaPagamento, Mensalidade } from "@/types";
import { iniciarPagamento, simularConfirmacaoPagamento } from "@/app/portal/actions";

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  Pago: { label: "Pago", className: "bg-success-50 text-success-700" },
  Pendente: { label: "Em aberto", className: "bg-warning-50 text-warning-700" },
  Vencido: { label: "Vencido", className: "bg-danger-50 text-danger-700" },
  "Em processamento": { label: "Em processamento", className: "bg-primary-50 text-primary-700" },
  Cancelado: { label: "Cancelado", className: "bg-gray-100 text-gray-500" },
};

const FORMAS: { key: FormaPagamento; label: string; icon: typeof QrCode }[] = [
  { key: "Pix", label: "Pix", icon: QrCode },
  { key: "Cartão de crédito", label: "Cartão", icon: CreditCard },
  { key: "Boleto", label: "Boleto", icon: Barcode },
];

type ChargeResult = Awaited<ReturnType<typeof iniciarPagamento>>;

export function MensalidadesList({ mensalidades }: { mensalidades: Mensalidade[] }) {
  const router = useRouter();
  const [formaSelecionada, setFormaSelecionada] = useState<Record<string, FormaPagamento>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [charge, setCharge] = useState<ChargeResult | null>(null);
  const [chargeForma, setChargeForma] = useState<FormaPagamento>("Pix");
  const [confirmando, setConfirmando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  async function handlePagar(m: Mensalidade) {
    const forma = formaSelecionada[m.id] ?? "Pix";
    setLoadingId(m.id);
    const result = await iniciarPagamento(m.id, forma);
    setLoadingId(null);
    if ("error" in result) return;
    setCharge(result);
    setChargeForma(forma);
    setConfirmado(false);
    setConfirmError("");
  }

  async function handleSimularConfirmacao() {
    if (!charge || "error" in charge) return;
    setConfirmando(true);
    const result = await simularConfirmacaoPagamento(charge.chargeId, chargeForma);
    setConfirmando(false);
    if (result.error) {
      setConfirmError(result.error);
      return;
    }
    setConfirmError("");
    setConfirmado(true);
    router.refresh();
  }

  function fechar() {
    setCharge(null);
    setConfirmado(false);
    setConfirmError("");
  }

  if (mensalidades.length === 0) {
    return (
      <div className="rounded-[10px] border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">Nenhuma mensalidade encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mensalidades.map((m) => {
        const style = STATUS_STYLE[m.status] ?? STATUS_STYLE.Pendente;
        const podePagar = m.status === "Pendente" || m.status === "Vencido";
        const forma = formaSelecionada[m.id] ?? "Pix";

        return (
          <div key={m.id} className="rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-sm font-semibold text-gray-800">
                Mensalidade {m.numeroParcela}/{m.totalParcelas}
              </p>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${style.className}`}>{style.label}</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] text-gray-400">Vencimento</p>
                <p className="font-medium text-gray-800">{formatDate(m.vencimento)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400">Valor</p>
                <p className="font-medium text-gray-800">{formatCurrency(m.valor)}</p>
              </div>
              {m.formaPagamento && (
                <div className="col-span-2">
                  <p className="text-[11px] text-gray-400">Forma de pagamento</p>
                  <p className="font-medium text-gray-800">{m.formaPagamento}</p>
                </div>
              )}
            </div>

            {podePagar && (
              <div className="mt-4">
                <div className="grid grid-cols-3 gap-2">
                  {FORMAS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFormaSelecionada((prev) => ({ ...prev, [m.id]: f.key }))}
                      className={`flex flex-col items-center gap-1 rounded-[8px] border py-2.5 text-[11px] font-medium ${
                        forma === f.key ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-200 text-gray-500"
                      }`}
                    >
                      <f.icon size={16} />
                      {f.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handlePagar(m)}
                  disabled={loadingId === m.id}
                  className="mt-3 h-12 w-full rounded-[8px] bg-primary-600 text-base font-semibold text-white active:bg-primary-700 disabled:bg-gray-300"
                >
                  {loadingId === m.id ? "Gerando cobrança..." : "Pagar"}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {charge && !("error" in charge) && (
        <PaymentSheet
          charge={charge}
          confirmando={confirmando}
          confirmado={confirmado}
          confirmError={confirmError}
          onConfirmar={handleSimularConfirmacao}
          onClose={fechar}
        />
      )}
    </div>
  );
}

function PaymentSheet({
  charge,
  confirmando,
  confirmado,
  confirmError,
  onConfirmar,
  onClose,
}: {
  charge: Exclude<ChargeResult, { error: string }>;
  confirmando: boolean;
  confirmado: boolean;
  confirmError: string;
  onConfirmar: () => void;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponível — sem problema, o texto já está selecionável
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-gray-900/50 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[16px] bg-white sm:rounded-[16px]">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <p className="text-sm font-semibold text-gray-900">
            {charge.tipo === "pix" ? "Pagar com Pix" : charge.tipo === "boleto" ? "Pagar com Boleto" : "Pagar com Cartão"}
          </p>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-[6px] text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {confirmado ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-600">
                <Check size={28} />
              </div>
              <p className="text-base font-semibold text-gray-900">Pagamento confirmado!</p>
              <p className="text-sm text-gray-500">A mensalidade já foi atualizada para Pago.</p>
              <button onClick={onClose} className="mt-3 h-11 w-full rounded-[8px] bg-primary-600 font-semibold text-white">
                Fechar
              </button>
            </div>
          ) : (
            <>
              {charge.tipo === "pix" && (
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-[10px] border border-gray-200 p-3">
                    <QRCodeSVG value={charge.copiaECola} size={200} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(charge.valor)}</p>
                  <button
                    onClick={() => copiar(charge.copiaECola)}
                    className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-gray-300 py-3 text-sm font-medium text-gray-700"
                  >
                    <ClipboardCopy size={16} />
                    {copiado ? "Copiado!" : "Pix copia e cola"}
                  </button>
                </div>
              )}

              {charge.tipo === "boleto" && (
                <div className="space-y-3">
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(charge.valor)}</p>
                  <div className="rounded-[8px] border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
                    {charge.linhaDigitavel}
                  </div>
                  <button
                    onClick={() => copiar(charge.linhaDigitavel)}
                    className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-gray-300 py-3 text-sm font-medium text-gray-700"
                  >
                    <ClipboardCopy size={16} />
                    {copiado ? "Copiado!" : "Copiar linha digitável"}
                  </button>
                  <a
                    href={charge.urlBoleto}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center rounded-[8px] bg-gray-100 py-3 text-sm font-medium text-gray-700"
                  >
                    Visualizar boleto
                  </a>
                </div>
              )}

              {charge.tipo === "cartao" && (
                <div className="space-y-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(charge.valor)}</p>
                  <p className="text-sm text-gray-500">
                    Você será redirecionado para o checkout seguro do gateway — o Aqua Park não armazena dados do cartão.
                  </p>
                  <a
                    href={charge.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center rounded-[8px] bg-gray-100 py-3 text-sm font-medium text-gray-700"
                  >
                    Abrir checkout
                  </a>
                </div>
              )}

              <div className="mt-5 border-t border-gray-100 pt-4">
                <p className="mb-2 text-center text-[11px] text-gray-400">
                  Sem gateway real conectado ainda — use o botão abaixo para simular a confirmação que normalmente chegaria
                  via webhook.
                </p>
                {confirmError && (
                  <div className="mb-2 rounded-[6px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
                    {confirmError}
                  </div>
                )}
                <button
                  onClick={onConfirmar}
                  disabled={confirmando}
                  className="h-12 w-full rounded-[8px] bg-gray-900 text-sm font-semibold text-white disabled:bg-gray-300"
                >
                  {confirmando ? "Confirmando..." : "Simular confirmação do gateway"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
