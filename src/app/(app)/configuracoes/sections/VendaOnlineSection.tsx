"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { salvarConfigVendaOnline } from "@/app/(app)/configuracoes/actions";
import type { ConfigVendaOnline } from "@/lib/venda-online/servidor";

export function VendaOnlineSection({ config }: { config: ConfigVendaOnline }) {
  const router = useRouter();
  const { pode } = useAcesso();
  const podeEditar = pode("venda_online.editar");
  const [ativa, setAtiva] = useState(config.ativa);
  const [limite, setLimite] = useState(config.limiteDiario === null ? "" : String(config.limiteDiario));
  const [horaLimite, setHoraLimite] = useState(config.horaLimite);
  const [dias, setDias] = useState(String(config.diasAntecedencia));
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function salvar() {
    setSalvando(true);
    setMensagem(null);
    const result = await salvarConfigVendaOnline({
      ativa,
      limiteDiario: limite.trim() ? Number(limite) : null,
      horaLimite,
      diasAntecedencia: Number(dias),
    });
    setSalvando(false);
    if (result.error) {
      setMensagem({ tipo: "erro", texto: result.error });
      return;
    }
    setMensagem({ tipo: "ok", texto: "Configuração salva." });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Venda Online</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Venda de ingressos pela internet, com Pix ou cartão. Os tipos vendidos são os marcados como &quot;Disponível para
            venda online&quot; em Tipos de Ingresso.
          </p>
        </div>
        <a
          href="/comprar"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:underline"
        >
          Abrir a página de compra
          <ExternalLink size={12} />
        </a>
      </div>

      <label
        className={cn(
          "flex items-start gap-2.5 rounded-[6px] border px-3 py-2.5",
          podeEditar ? "cursor-pointer" : "opacity-60",
          ativa ? "border-primary-500 bg-primary-50" : "border-gray-200",
        )}
      >
        <input type="checkbox" className="mt-0.5" checked={ativa} disabled={!podeEditar} onChange={(e) => setAtiva(e.target.checked)} />
        <span>
          <span className="block text-sm font-medium text-gray-800">Venda online ligada</span>
          <span className="block text-[11px] text-gray-500">Desligada, a página /comprar mostra &quot;venda online indisponível&quot;.</span>
        </span>
      </label>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label>Limite de ingressos online por dia</Label>
          <Input
            type="number"
            min={1}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            placeholder="Sem limite"
            disabled={!podeEditar}
          />
          <p className="mt-1 text-[11px] text-gray-400">Em branco = sem limite. A bilheteria do parque não entra nessa conta.</p>
        </div>
        <div>
          <Label>Compra para o próprio dia até</Label>
          <Input type="time" value={horaLimite} onChange={(e) => setHoraLimite(e.target.value)} disabled={!podeEditar} />
          <p className="mt-1 text-[11px] text-gray-400">Depois desse horário, só a partir de amanhã.</p>
        </div>
        <div>
          <Label>Vender até quantos dias à frente</Label>
          <Input type="number" min={0} max={365} value={dias} onChange={(e) => setDias(e.target.value)} disabled={!podeEditar} />
        </div>
      </div>

      <p className="mt-4 text-[11px] text-gray-400">
        O comprador tem 30 minutos para pagar o Pix; até lá os ingressos do pedido ficam reservados no limite do dia. Pix pago
        depois do prazo também é emitido. Ingressos online não têm cancelamento nem reembolso.
      </p>

      {mensagem && (
        <p className={cn("mt-3 text-xs", mensagem.tipo === "ok" ? "text-success-700" : "text-danger-600")}>{mensagem.texto}</p>
      )}

      {podeEditar && (
        <div className="mt-5 flex justify-end">
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      )}
    </div>
  );
}
