"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Input, Textarea } from "@/components/ui/Field";
import { formatCurrency, parseMoney } from "@/lib/utils";
import { Caixa, CaixaMovimentoTipo, CaixaResumo } from "@/types";
import { abrirCaixa, carregarResumoCaixa, fecharCaixa, registrarMovimento } from "@/app/(app)/caixa/actions";
import { CaixaResumoView } from "./CaixaResumoView";

function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mt-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
      {message}
    </div>
  );
}

export function AbrirCaixaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [operador, setOperador] = useState("");
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAbrir() {
    if (!operador.trim()) {
      setError("Informe o nome do operador.");
      return;
    }
    const numero = valor.trim() === "" ? 0 : parseMoney(valor);
    if (Number.isNaN(numero)) {
      setError("Informe um valor de abertura válido.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await abrirCaixa(numero, operador);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader title="Abrir caixa" onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          <div>
            <Label required>Nome do operador</Label>
            <Input
              value={operador}
              onChange={(e) => setOperador(e.target.value)}
              placeholder="Quem vai operar este caixa"
              autoFocus
            />
          </div>
          <div>
            <Label>Valor de abertura (fundo de troco)</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" />
            <p className="mt-1 text-[11px] text-gray-400">
              Dinheiro que já está na gaveta ao começar o turno. Pode ser zero.
            </p>
          </div>
        </div>
        <ErrorBox message={error} />
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleAbrir} disabled={saving}>
          {saving ? "Abrindo..." : "Abrir caixa"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export function MovimentoModal({
  open,
  onClose,
  tipo,
  caixa,
  dinheiroEmCaixa,
}: {
  open: boolean;
  onClose: () => void;
  tipo: CaixaMovimentoTipo;
  caixa: Caixa;
  dinheiroEmCaixa: number;
}) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sangria = tipo === "Sangria";

  async function handleSalvar() {
    const numero = parseMoney(valor);
    if (Number.isNaN(numero) || numero <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (sangria && !motivo.trim()) {
      setError("Informe o motivo da sangria.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await registrarMovimento({ caixaId: caixa.id, tipo, valor: numero, motivo });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader title={sangria ? "Registrar sangria" : "Registrar suprimento"} onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            {sangria
              ? `Retirada de dinheiro do caixa (ex: envio ao cofre). Disponível em caixa: ${formatCurrency(dinheiroEmCaixa)}.`
              : "Entrada de dinheiro no caixa (ex: reforço de troco)."}
          </p>
          <div>
            <Label required>Valor</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" autoFocus />
          </div>
          <div>
            <Label required={sangria}>Motivo</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={sangria ? "Ex: Envio ao cofre" : "Ex: Reforço de troco"}
            />
          </div>
        </div>
        <ErrorBox message={error} />
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant={sangria ? "destructive" : "primary"} onClick={handleSalvar} disabled={saving}>
          {saving ? "Salvando..." : sangria ? "Confirmar sangria" : "Confirmar suprimento"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export function FecharCaixaModal({
  open,
  onClose,
  caixa,
  dinheiroEsperado,
}: {
  open: boolean;
  onClose: () => void;
  caixa: Caixa;
  dinheiroEsperado: number;
}) {
  const router = useRouter();
  const [contado, setContado] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const valorContado = parseMoney(contado);
  const diferenca = Number.isNaN(valorContado) ? null : Math.round((valorContado - dinheiroEsperado) * 100) / 100;

  async function handleFechar() {
    if (Number.isNaN(valorContado)) {
      setError("Informe o valor contado no caixa.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await fecharCaixa({ caixaId: caixa.id, valorContado, observacoes });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalHeader title={`Fechar caixa ${caixa.numero}`} onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-[6px] border border-gray-200 bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-600">Dinheiro esperado em caixa</span>
            <span className="text-lg font-semibold text-gray-900">{formatCurrency(dinheiroEsperado)}</span>
          </div>
          <div>
            <Label required>Dinheiro contado</Label>
            <Input value={contado} onChange={(e) => setContado(e.target.value)} placeholder="0,00" inputMode="decimal" autoFocus />
          </div>
          {diferenca !== null && (
            <div
              className={
                diferenca === 0
                  ? "rounded-[4px] border border-success-600/30 bg-success-50 px-3 py-2 text-xs text-success-700"
                  : "rounded-[4px] border border-warning-600/30 bg-warning-50 px-3 py-2 text-xs text-warning-700"
              }
            >
              {diferenca === 0
                ? "Caixa conferido, sem diferença."
                : `${diferenca > 0 ? "Sobra" : "Falta"} de ${formatCurrency(Math.abs(diferenca))}. Informe uma observação.`}
            </div>
          )}
          <div>
            <Label required={diferenca !== null && diferenca !== 0}>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional quando não há diferença" />
          </div>
          <p className="text-[11px] text-gray-400">
            Depois de fechado, o caixa não aceita novas vendas. Um supervisor pode reabri-lo pelo histórico.
          </p>
        </div>
        <ErrorBox message={error} />
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleFechar} disabled={saving}>
          {saving ? "Fechando..." : "Fechar caixa"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export function DetalheCaixaModal({ caixaId, onClose }: { caixaId: string | null; onClose: () => void }) {
  const [resumo, setResumo] = useState<CaixaResumo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!caixaId) return;
    let cancelado = false;
    setLoading(true);
    setResumo(null);
    carregarResumoCaixa(caixaId).then((r) => {
      if (cancelado) return;
      setResumo(r);
      setLoading(false);
    });
    return () => {
      cancelado = true;
    };
  }, [caixaId]);

  return (
    <Modal open={!!caixaId} onClose={onClose} size="xl">
      <ModalHeader title={resumo ? `Caixa ${resumo.caixa.numero}` : "Detalhes do caixa"} onClose={onClose} />
      <ModalBody>
        {loading && <p className="py-8 text-center text-sm text-gray-400">Carregando...</p>}
        {!loading && !resumo && caixaId && <p className="py-8 text-center text-sm text-gray-400">Caixa não encontrado.</p>}
        {resumo && <CaixaResumoView resumo={resumo} />}
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>Fechar</Button>
      </ModalFooter>
    </Modal>
  );
}
