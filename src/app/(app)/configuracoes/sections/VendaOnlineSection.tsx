"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { definirDatasFuncionamento, salvarConfigVendaOnline } from "@/app/(app)/configuracoes/actions";
import { Calendario, somarMeses } from "@/components/ui/Calendario";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { RemarcarModal } from "@/components/bilheteria/RemarcarModal";
import { contarIngressosDoDia, remarcarDia } from "@/app/(app)/bilheteria/actions";
import { formatDate } from "@/lib/utils";
import type { ConfigVendaOnline } from "@/lib/venda-online/servidor";

function hojeBR() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function VendaOnlineSection({ config, datasAbertas }: { config: ConfigVendaOnline; datasAbertas: string[] }) {
  const router = useRouter();
  const { pode } = useAcesso();
  const podeEditar = pode("venda_online.editar");
  const [ativa, setAtiva] = useState(config.ativa);
  const [limite, setLimite] = useState(config.limiteDiario === null ? "" : String(config.limiteDiario));
  const [horaLimite, setHoraLimite] = useState(config.horaLimite);
  const [dias, setDias] = useState(String(config.diasAntecedencia));
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // Dias de funcionamento: cada clique abre/fecha o dia e já salva.
  const hoje = hojeBR();
  const [abertas, setAbertas] = useState(() => new Set(datasAbertas));
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [erroDatas, setErroDatas] = useState("");
  const [avisoDatas, setAvisoDatas] = useState("");
  // Fechar um dia que já tem ingressos vendidos: pergunta antes o que fazer com eles.
  const [fechando, setFechando] = useState<{ data: string; quantidade: number } | null>(null);
  const [remarcandoDia, setRemarcandoDia] = useState<string | null>(null);

  async function aplicar(abrir: string[], fechar: string[]) {
    if (abrir.length === 0 && fechar.length === 0) return;
    setErroDatas("");
    const anterior = abertas;
    const nova = new Set(abertas);
    abrir.forEach((d) => nova.add(d));
    fechar.forEach((d) => nova.delete(d));
    setAbertas(nova);
    const result = await definirDatasFuncionamento({ abrir, fechar });
    if (result.error) {
      setAbertas(anterior);
      setErroDatas(result.error);
    }
  }

  function diasDoMes(): string[] {
    const [ano, m] = mes.split("-").map(Number);
    const total = new Date(Date.UTC(ano, m, 0)).getUTCDate();
    return Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`).filter((d) => d >= hoje);
  }

  async function fecharDia(d: string) {
    setAvisoDatas("");
    const contagem = await contarIngressosDoDia(d);
    if ("quantidade" in contagem && contagem.quantidade > 0) {
      setFechando({ data: d, quantidade: contagem.quantidade });
      return;
    }
    aplicar([], [d]);
  }

  /** "Limpar mês" só fecha os dias sem ingressos vendidos; os outros são fechados um a um (para remarcar). */
  async function limparMes() {
    setAvisoDatas("");
    const contagens = await Promise.all(abertasNoMes.map(async (d) => ({ d, r: await contarIngressosDoDia(d) })));
    const comIngressos = contagens.filter(({ r }) => !("quantidade" in r) || r.quantidade > 0).map(({ d }) => d);
    aplicar(
      [],
      abertasNoMes.filter((d) => !comIngressos.includes(d)),
    );
    if (comIngressos.length > 0) {
      setAvisoDatas(
        `Não fechei ${comIngressos.map((d) => formatDate(d).slice(0, 5)).join(", ")}: já têm ingressos vendidos. Clique em cada dia para fechar e remarcar.`,
      );
    }
  }

  function abrirFinsDeSemana() {
    const fds = diasDoMes().filter((d) => {
      const dia = new Date(`${d}T12:00:00Z`).getUTCDay();
      return (dia === 0 || dia === 6) && !abertas.has(d);
    });
    aplicar(fds, []);
  }

  const abertasNoMes = diasDoMes().filter((d) => abertas.has(d));

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

      <div className="mt-6 border-t border-gray-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dias de funcionamento</p>
        <p className="mt-1 text-xs text-gray-500">
          A página de compra só deixa escolher os dias marcados aqui (em azul). Clique num dia para abrir ou fechar — salva na
          hora. Sem nenhum dia marcado, não há datas à venda.
        </p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="w-full max-w-xs rounded-[6px] border border-gray-200 p-3">
            <Calendario
              mes={mes}
              onMudarMes={setMes}
              mesMinimo={hoje.slice(0, 7)}
              mesMaximo={somarMeses(hoje.slice(0, 7), 12)}
              estadoDoDia={(d) => (d < hoje || !podeEditar ? (abertas.has(d) ? "marcado" : "desabilitado") : abertas.has(d) ? "marcado" : "disponivel")}
              onClicarDia={(d) => {
                if (d < hoje || !podeEditar) return;
                if (abertas.has(d)) fecharDia(d);
                else aplicar([d], []);
              }}
            />
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">
              <strong className="text-gray-900">{abertasNoMes.length}</strong> dia(s) aberto(s) neste mês
            </p>
            {podeEditar && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={abrirFinsDeSemana}>
                  Abrir fins de semana do mês
                </Button>
                <Button variant="ghost" size="sm" onClick={limparMes} disabled={abertasNoMes.length === 0}>
                  Limpar mês
                </Button>
              </div>
            )}
            {erroDatas && <p className="text-xs text-danger-600">{erroDatas}</p>}
            {avisoDatas && <p className="max-w-xs text-xs text-warning-700">{avisoDatas}</p>}
          </div>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-gray-400">
        O comprador tem 30 minutos para pagar o Pix; até lá os ingressos do pedido ficam reservados no limite do dia. Pix pago
        depois do prazo também é emitido. Ingressos online não têm cancelamento nem reembolso.
      </p>

      {mensagem && (
        <p className={cn("mt-3 text-xs", mensagem.tipo === "ok" ? "text-success-700" : "text-danger-600")}>{mensagem.texto}</p>
      )}

      <Modal open={!!fechando} onClose={() => setFechando(null)} size="md">
        <ModalHeader title={fechando ? `Fechar ${formatDate(fechando.data)}?` : ""} onClose={() => setFechando(null)} />
        <ModalBody>
          {fechando && (
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                Já existem <strong>{fechando.quantidade} ingresso(s)</strong> não usados para {formatDate(fechando.data)} (balcão e
                online).
              </p>
              <p>
                Se o parque não vai abrir, remarque esses ingressos para outra data — os compradores online recebem um e-mail. Fechar
                sem remarcar só tira o dia da venda online: os ingressos já vendidos continuam valendo nessa data.
              </p>
              {!pode("ingressos.alterar_data") && (
                <p className="text-warning-700">Você não tem a permissão &quot;Alterar data de utilização&quot; para remarcar.</p>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setFechando(null)}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (fechando) aplicar([], [fechando.data]);
                setFechando(null);
              }}
            >
              Fechar sem remarcar
            </Button>
            {pode("ingressos.alterar_data") && (
              <Button
                onClick={() => {
                  setRemarcandoDia(fechando?.data ?? null);
                  setFechando(null);
                }}
              >
                Fechar e remarcar
              </Button>
            )}
          </div>
        </ModalFooter>
      </Modal>

      {remarcandoDia && (
        <RemarcarModal
          open
          onClose={() => setRemarcandoDia(null)}
          titulo={`Remarcar os ingressos de ${formatDate(remarcandoDia)}`}
          dataAtual={remarcandoDia}
          descricao={
            <p>
              Todos os ingressos ainda não usados de <strong>{formatDate(remarcandoDia)}</strong> vão para a nova data, e o dia sai
              da venda online.
            </p>
          }
          onConfirmar={async (novaData, motivo) => {
            const result = await remarcarDia({ dataAnterior: remarcandoDia, novaData, motivo });
            if (!("error" in result)) await aplicar([], [remarcandoDia]);
            return result;
          }}
        />
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
