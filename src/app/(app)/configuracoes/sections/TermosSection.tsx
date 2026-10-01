"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Field";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { formatDateTime } from "@/lib/utils";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { publicarTermos } from "@/app/(app)/configuracoes/actions";

export interface VersaoTermosLista {
  id: string;
  versao: number;
  conteudo: string;
  publicadoEm: string;
  publicadoPor: string;
}

export function TermosSection({ versoes }: { versoes: VersaoTermosLista[] }) {
  const router = useRouter();
  const { pode } = useAcesso();
  const vigente = versoes[0] ?? null;
  const [texto, setTexto] = useState(vigente?.conteudo ?? "");
  const [confirmando, setConfirmando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState("");
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const alterado = texto.trim() !== (vigente?.conteudo ?? "").trim();

  async function publicar() {
    setPublicando(true);
    setError("");
    const result = await publicarTermos(texto);
    setPublicando(false);
    setConfirmando(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Termos de Adesão</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            O associado aceita estes termos no autocadastro e, se foi cadastrado pela equipe, no primeiro acesso ao Portal.
          </p>
        </div>
        {vigente ? (
          <Badge tone="success">
            Versão {vigente.versao} em vigor desde {formatDateTime(vigente.publicadoEm)}
          </Badge>
        ) : (
          <Badge tone="warning">Nenhuma versão publicada — o autocadastro fica indisponível</Badge>
        )}
      </div>

      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        readOnly={!pode("termos.publicar")}
        rows={16}
        className="h-auto min-h-[320px] py-2 leading-relaxed"
        placeholder="Escreva aqui os termos de adesão do Aqua Park: regras de uso, mensalidades, cancelamento, uso de imagem, LGPD..."
      />
      <p className="mt-1 text-[11px] text-gray-400">Quebras de linha são mantidas. Versões publicadas não são alteradas: cada mudança vira uma versão nova.</p>

      {error && (
        <div className="mt-3 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</div>
      )}

      {pode("termos.publicar") && (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setConfirmando(true)} disabled={!alterado || !texto.trim()}>
            {vigente ? `Publicar versão ${vigente.versao + 1}` : "Publicar versão 1"}
          </Button>
        </div>
      )}

      {versoes.length > 0 && (
        <div className="mt-6 border-t border-gray-100 pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Histórico de versões</p>
          <ul className="divide-y divide-gray-100 rounded-[6px] border border-gray-200">
            {versoes.map((v) => (
              <li key={v.id} className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setAbertaId(abertaId === v.id ? null : v.id)}
                  className="flex w-full items-center justify-between gap-3 text-left text-sm"
                >
                  <span className="font-medium text-gray-800">
                    Versão {v.versao}
                    {v.id === vigente?.id && <span className="ml-2 text-xs font-normal text-success-700">em vigor</span>}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDateTime(v.publicadoEm)} · {v.publicadoPor}
                  </span>
                </button>
                {abertaId === v.id && (
                  <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-[4px] bg-gray-50 p-3 text-xs text-gray-600">
                    {v.conteudo}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={confirmando} onClose={() => setConfirmando(false)} size="md">
        <ModalHeader title={`Publicar versão ${(vigente?.versao ?? 0) + 1}?`} onClose={() => setConfirmando(false)} />
        <ModalBody>
          <div className="space-y-2 text-sm text-gray-600">
            <p>A versão nova passa a valer na hora:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>novos cadastros pela internet aceitam esta versão;</li>
              <li>
                <strong>todos os associados</strong> precisarão aceitá-la no próximo acesso ao Portal (o pagamento de mensalidades
                continua liberado).
              </li>
            </ul>
            <p>Depois de publicada, a versão não pode ser editada — só substituída por outra.</p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setConfirmando(false)} disabled={publicando}>
            Voltar
          </Button>
          <Button onClick={publicar} disabled={publicando}>
            {publicando ? "Publicando..." : "Publicar"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
