"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Gift, Printer, XCircle } from "lucide-react";
import { Badge, StatusTone } from "@/components/ui/Badge";
import { cn, formatDate } from "@/lib/utils";
import type { SituacaoCortesia } from "@/lib/cortesia";

type Resultado = { error: string } | { success: true };

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  Disponível: { label: "Pronta para usar", tone: "success" },
  Utilizado: { label: "Já utilizada", tone: "neutral" },
  Expirado: { label: "Expirada", tone: "danger" },
  Cancelado: { label: "Cancelada", tone: "neutral" },
};

/**
 * Cortesia do mês: resgatar (escolhendo a data da visita) ou ver o ingresso já
 * resgatado. Usado no Portal (associado) e no perfil do associado (equipe).
 */
export function CortesiaCard({
  situacao,
  variante,
  onResgatar,
  onCancelar,
  podeGerenciar = true,
}: {
  situacao: SituacaoCortesia;
  variante: "portal" | "painel";
  onResgatar: (dataUtilizacao: string) => Promise<Resultado>;
  /** Só no painel: cancela a cortesia ainda não usada e libera o mês. */
  onCancelar?: (ingressoId: string) => Promise<Resultado>;
  /** Painel: se o usuário tem a permissão de resgatar/cancelar. */
  podeGerenciar?: boolean;
}) {
  const router = useRouter();
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState(situacao.hoje);
  const [enviando, setEnviando] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [error, setError] = useState("");
  const portal = variante === "portal";
  const ingresso = situacao.ingresso;

  async function resgatar() {
    setEnviando(true);
    setError("");
    const result = await onResgatar(data);
    setEnviando(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function cancelar() {
    if (!ingresso || !onCancelar) return;
    setEnviando(true);
    setError("");
    const result = await onCancelar(ingresso.id);
    setEnviando(false);
    setConfirmandoCancelar(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  function baixarQr() {
    const canvas = qrRef.current;
    if (!canvas || !ingresso) return;
    const link = document.createElement("a");
    link.download = `cortesia-${ingresso.numero}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const status = ingresso ? (STATUS[ingresso.status] ?? STATUS.Disponível) : null;

  return (
    <div className={cn("bg-white", portal ? "rounded-[10px] border border-gray-200 p-5 shadow-sm" : "")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift size={18} className="text-primary-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Cortesia de {situacao.rotuloMes.split(" de ")[0]}</p>
            <p className="text-xs text-gray-500">1 ingresso de cortesia por mês</p>
          </div>
        </div>
        {status && <Badge tone={status.tone}>{status.label}</Badge>}
      </div>

      {ingresso ? (
        <div className={cn("mt-4 flex gap-4", portal ? "flex-col items-center text-center" : "items-center")}>
          <div className="rounded-[6px] border border-gray-200 bg-white p-2">
            <QRCodeCanvas ref={qrRef} value={ingresso.codigo} size={portal ? 168 : 104} />
          </div>
          <div className="space-y-0.5 text-sm">
            <p className="font-medium text-gray-800">{ingresso.tipo}</p>
            <p className="text-gray-600">
              Válido em <strong>{formatDate(ingresso.dataUtilizacao)}</strong>
            </p>
            <p className="text-xs text-gray-500">
              Nº {ingresso.numero} · Código {ingresso.codigo}
            </p>
            {portal && (
              <p className="pt-1 text-xs text-gray-500">Apresente o QR Code ou o código na entrada. Quem estiver com ele entra.</p>
            )}
            <div className={cn("flex flex-wrap gap-2 pt-2", portal && "justify-center")}>
              {portal && ingresso.status === "Disponível" && (
                <button
                  type="button"
                  onClick={baixarQr}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-gray-300 px-3 text-sm font-medium text-gray-700"
                >
                  <Download size={14} />
                  Baixar QR Code
                </button>
              )}
              {!portal && (
                <Link
                  href={`/imprimir/ingresso/${ingresso.id}`}
                  target="_blank"
                  className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Printer size={13} />
                  Imprimir
                </Link>
              )}
              {!portal && onCancelar && podeGerenciar && ingresso.status === "Disponível" && (
                <>
                  {confirmandoCancelar ? (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      Cancelar a cortesia?
                      <button type="button" onClick={cancelar} disabled={enviando} className="font-semibold text-danger-600">
                        Sim
                      </button>
                      <button type="button" onClick={() => setConfirmandoCancelar(false)} className="text-gray-500">
                        Não
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmandoCancelar(true)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[4px] px-2 text-xs font-medium text-danger-600 hover:bg-danger-50"
                    >
                      <XCircle size={13} />
                      Cancelar
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : situacao.podeResgatar && podeGerenciar ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-gray-600">Data da visita</span>
            <input
              type="date"
              value={data}
              min={situacao.hoje}
              max={situacao.ultimoDia}
              onChange={(e) => setData(e.target.value)}
              className={cn(
                "w-full rounded-[6px] border border-gray-300 bg-white px-3 text-gray-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100",
                portal ? "h-12 text-base" : "h-9 text-sm sm:w-48",
              )}
            />
            <span className="mt-1 block text-[11px] text-gray-400">
              De hoje até {formatDate(situacao.ultimoDia)}. O ingresso vale só no dia escolhido.
            </span>
          </label>
          <button
            type="button"
            onClick={resgatar}
            disabled={enviando || !data}
            className={cn(
              "rounded-[6px] bg-primary-600 font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-gray-300",
              portal ? "h-12 w-full text-base" : "h-9 px-4 text-sm",
            )}
          >
            {enviando ? "Resgatando..." : "Resgatar cortesia"}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-500">
          {situacao.podeResgatar ? "Disponível para resgate." : (situacao.motivo ?? "Indisponível.")}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
    </div>
  );
}
