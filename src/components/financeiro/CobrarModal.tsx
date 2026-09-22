"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Barcode, Check, ClipboardCopy, CreditCard, QrCode } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { FormaPagamento } from "@/types";
import { cobrarMensalidade } from "@/app/(app)/financeiro/actions";

export interface MensalidadeParaCobranca {
  id: string;
  vencimento: string;
  valor: number;
  descricao?: string;
}

const FORMAS: { key: FormaPagamento; label: string; icon: typeof QrCode }[] = [
  { key: "Pix", label: "Pix", icon: QrCode },
  { key: "Cartão de crédito", label: "Cartão", icon: CreditCard },
  { key: "Boleto", label: "Boleto", icon: Barcode },
];

type Resultado =
  | { tipo: "pix"; copiaECola: string; valor: number }
  | { tipo: "boleto"; linhaDigitavel: string; urlBoleto: string; valor: number }
  | { tipo: "cartao"; checkoutUrl: string; valor: number };

export function CobrarModal({
  mensalidade,
  onClose,
}: {
  mensalidade: MensalidadeParaCobranca | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [forma, setForma] = useState<FormaPagamento>("Pix");
  const [gerando, setGerando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiado, setCopiado] = useState(false);

  function fechar() {
    onClose();
    // Só limpa depois de fechado — evita o conteúdo "piscar" durante a animação de saída.
    setTimeout(() => {
      setResultado(null);
      setError("");
      setForma("Pix");
    }, 200);
  }

  async function handleGerar() {
    if (!mensalidade) return;
    setGerando(true);
    setError("");
    const result = await cobrarMensalidade(mensalidade.id, forma);
    setGerando(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setResultado(result as Resultado);
    router.refresh();
  }

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
    <Modal open={!!mensalidade} onClose={fechar} size="md">
      <ModalHeader
        title="Cobrar mensalidade"
        subtitle={mensalidade ? `${mensalidade.descricao ?? "Mensalidade"} — vencimento ${formatDate(mensalidade.vencimento)}` : undefined}
        onClose={fechar}
      />
      <ModalBody>
        {!mensalidade ? null : !resultado ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Gera uma cobrança real de <strong>{formatCurrency(mensalidade.valor)}</strong> no Asaas em nome do associado. A
              mensalidade é atualizada sozinha assim que o pagamento for confirmado — não precisa fazer mais nada aqui.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {FORMAS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setForma(f.key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-[6px] border py-3 text-xs font-medium transition-colors",
                    forma === f.key ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-200 text-gray-500 hover:border-gray-300",
                  )}
                >
                  <f.icon size={18} />
                  {f.label}
                </button>
              ))}
            </div>
            {error && (
              <div className="rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {resultado.tipo === "pix" && (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-[10px] border border-gray-200 p-3">
                  <QRCodeSVG value={resultado.copiaECola} size={180} />
                </div>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(resultado.valor)}</p>
                <Button variant="secondary" className="w-full" onClick={() => copiar(resultado.copiaECola)}>
                  {copiado ? <Check size={14} /> : <ClipboardCopy size={14} />}
                  {copiado ? "Copiado!" : "Pix copia e cola"}
                </Button>
                <p className="text-center text-xs text-gray-400">Mostre o QR Code para o associado escanear no app do banco dele.</p>
              </div>
            )}

            {resultado.tipo === "boleto" && (
              <div className="space-y-3">
                <p className="text-xl font-bold text-gray-900">{formatCurrency(resultado.valor)}</p>
                <div className="rounded-[6px] border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
                  {resultado.linhaDigitavel}
                </div>
                <Button variant="secondary" className="w-full" onClick={() => copiar(resultado.linhaDigitavel)}>
                  {copiado ? <Check size={14} /> : <ClipboardCopy size={14} />}
                  {copiado ? "Copiado!" : "Copiar linha digitável"}
                </Button>
                <a
                  href={resultado.urlBoleto}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-full items-center justify-center rounded-[4px] bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Abrir / imprimir boleto
                </a>
              </div>
            )}

            {resultado.tipo === "cartao" && (
              <div className="space-y-3 text-center">
                <p className="text-xl font-bold text-gray-900">{formatCurrency(resultado.valor)}</p>
                <p className="text-sm text-gray-500">
                  Envie este link para o associado preencher os dados do cartão dele no checkout seguro do Asaas — o Aqua
                  Park não vê nem armazena o número do cartão.
                </p>
                <a
                  href={resultado.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-full items-center justify-center rounded-[4px] bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Abrir checkout
                </a>
                <Button variant="secondary" className="w-full" onClick={() => copiar(resultado.checkoutUrl)}>
                  {copiado ? <Check size={14} /> : <ClipboardCopy size={14} />}
                  {copiado ? "Copiado!" : "Copiar link"}
                </Button>
              </div>
            )}

            <p className="border-t border-gray-100 pt-3 text-center text-[11px] text-gray-400">
              A mensalidade muda para &quot;Pago&quot; automaticamente quando o pagamento for confirmado.
            </p>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={fechar}>
          {resultado ? "Fechar" : "Cancelar"}
        </Button>
        {!resultado && (
          <Button onClick={handleGerar} disabled={gerando}>
            {gerando ? "Gerando..." : "Gerar cobrança"}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
