"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Eye, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Th, Tr, Td, TableEmpty } from "@/components/ui/Table";
import { Badge, StatusTone } from "@/components/ui/Badge";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Label, Select, Input } from "@/components/ui/Field";
import { formatDate } from "@/lib/utils";
import { ContratoGerado, ModeloContrato } from "@/lib/supabase/contratos";
import { Associado } from "@/types";
import { gerarContrato } from "@/app/(app)/contratos/actions";

const STATUS_TONE: Record<string, StatusTone> = {
  Rascunho: "neutral",
  Gerado: "info",
  "Enviado para assinatura": "warning",
  Assinado: "success",
  Recusado: "danger",
  Cancelado: "neutral",
};

export function ContratosTabContent({
  associado,
  contratos,
  modelos,
  onEditAssociado,
}: {
  associado: Associado;
  contratos: ContratoGerado[];
  modelos: ModeloContrato[];
  onEditAssociado: () => void;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [modeloId, setModeloId] = useState("");
  const [dataContrato, setDataContrato] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<{ key: string; label: string; group: string }[]>([]);
  const [viewing, setViewing] = useState<ContratoGerado | null>(null);

  function openModal() {
    setModeloId("");
    setError("");
    setMissing([]);
    setModalOpen(true);
  }

  async function handleGerar() {
    if (!modeloId) {
      setError("Selecione um modelo de contrato.");
      return;
    }
    setSaving(true);
    setError("");
    setMissing([]);
    const result = await gerarContrato({ associadoId: associado.id, modeloId, dataContrato });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      if (result.missing) setMissing(result.missing);
      return;
    }

    setModalOpen(false);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Contratos gerados</p>
        <Button size="sm" onClick={openModal} disabled={modelos.length === 0}>
          <FilePlus2 size={14} />
          Gerar contrato
        </Button>
      </div>

      {modelos.length === 0 && (
        <p className="mb-3 text-xs text-warning-700">
          Nenhum modelo de contrato ativo. Cadastre um em Contratos → Modelos de contrato antes de gerar.
        </p>
      )}

      <Table className="rounded-[6px] border border-gray-200">
        <Thead>
          <tr>
            <Th>Contrato</Th>
            <Th>Modelo</Th>
            <Th>Data</Th>
            <Th>Status</Th>
            <Th>Ações</Th>
          </tr>
        </Thead>
        <Tbody>
          {contratos.length === 0 && <TableEmpty colSpan={5} message="Nenhum contrato gerado para este associado ainda." />}
          {contratos.map((c) => (
            <Tr key={c.id}>
              <Td className="font-medium text-gray-800">{c.numero}</Td>
              <Td>
                {c.modeloNome} <span className="text-xs text-gray-400">v{c.modeloVersao.toFixed(1)}</span>
              </Td>
              <Td>{formatDate(c.dataContrato)}</Td>
              <Td>
                <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
              </Td>
              <Td>
                <div className="flex gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => setViewing(c)}>
                    <Eye size={13} />
                    Visualizar
                  </Button>
                  <Button variant="ghost" size="sm" disabled title="Integração com Authentic ainda não disponível">
                    <Send size={13} />
                    Enviar p/ assinatura
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="md">
        <ModalHeader title="Gerar contrato" onClose={() => setModalOpen(false)} />
        <ModalBody>
          <div className="space-y-4">
            <div>
              <Label>Associado</Label>
              <Input value={associado.nome} disabled />
            </div>
            <div>
              <Label required>Modelo</Label>
              <Select value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
                <option value="">Selecione</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label required>Data do contrato</Label>
              <Input type="date" value={dataContrato} onChange={(e) => setDataContrato(e.target.value)} />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">
              <p className="font-medium">{error}</p>
              {missing.length > 0 && (
                <>
                  <ul className="mt-1.5 list-disc pl-4">
                    {missing.map((m) => (
                      <li key={m.key}>
                        {m.label} do {m.group.toLowerCase()}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => {
                      setModalOpen(false);
                      onEditAssociado();
                    }}
                    className="mt-2 font-medium text-danger-700 underline"
                  >
                    Editar associado
                  </button>
                </>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGerar} disabled={saving}>
            {saving ? "Gerando..." : "Gerar contrato"}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} size="lg">
        <ModalHeader title={viewing ? `Contrato ${viewing.numero}` : ""} onClose={() => setViewing(null)} />
        <ModalBody>
          {viewing && (
            <div
              className="prose prose-sm max-w-none rounded-[6px] border border-gray-200 p-6 text-sm leading-relaxed text-gray-800 [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2"
              dangerouslySetInnerHTML={{ __html: viewing.conteudoHtml }}
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setViewing(null)}>
            Fechar
          </Button>
          <div />
        </ModalFooter>
      </Modal>
    </div>
  );
}
