"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bold, Eye, Italic, Underline, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { InsertVariableMenu } from "@/components/contratos/InsertVariableMenu";
import { ModeloContrato } from "@/lib/supabase/contratos";
import { ContractData, substituteVariables } from "@/lib/contracts/variables";
import { getPreviewData, updateModeloConteudo } from "../../actions";

export function ModeloEditorClient({
  modelo,
  associadosOptions,
}: {
  modelo: ModeloContrato;
  associadosOptions: { id: string; nome: string; numero: string }[];
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [versao, setVersao] = useState(modelo.versao);
  const [readOnly, setReadOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedAssociado, setSelectedAssociado] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = modelo.conteudoHtml;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function insertVariable(key: string) {
    editorRef.current?.focus();
    document.execCommand("insertText", false, `{{${key}}}`);
  }

  function exec(command: string) {
    editorRef.current?.focus();
    document.execCommand(command);
  }

  async function handleSave() {
    if (!editorRef.current) return;
    setSaving(true);
    setSavedMsg("");
    const result = await updateModeloConteudo(modelo.id, editorRef.current.innerHTML);
    setSaving(false);
    if (result.versao) {
      setVersao(result.versao);
      setSavedMsg(`Salvo — versão ${result.versao}`);
      setTimeout(() => setSavedMsg(""), 3000);
    }
  }

  async function handlePreviewComAssociado(associadoId: string) {
    setSelectedAssociado(associadoId);
    if (!associadoId || !editorRef.current) {
      setPreviewHtml("");
      return;
    }
    setPreviewLoading(true);
    const data = await getPreviewData(associadoId);
    setPreviewLoading(false);
    if ("error" in data) return;

    const contractData: ContractData = {
      associado: data.associado,
      plano: data.plano,
      empresa: data.empresa,
      contrato: {
        numero: "PREVIEW",
        data: new Date().toISOString().slice(0, 10),
        dataInicio: "",
        dataFim: "",
      },
    };
    setPreviewHtml(substituteVariables(editorRef.current.innerHTML, contractData));
  }

  return (
    <div>
      <Link href="/contratos" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} />
        Voltar para Contratos
      </Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-gray-900">{modelo.nome}</h1>
            <Badge tone={modelo.status === "Ativo" ? "success" : "neutral"}>{modelo.status}</Badge>
            <span className="text-xs text-gray-400">v{versao.toFixed(1)}</span>
          </div>
          {modelo.descricao && <p className="mt-0.5 text-xs text-gray-500">{modelo.descricao}</p>}
        </div>

        <div className="flex items-center gap-2">
          {savedMsg && <span className="text-xs font-medium text-success-600">{savedMsg}</span>}
          <Button variant="secondary" size="sm" onClick={() => setReadOnly((v) => !v)}>
            <Eye size={14} />
            {readOnly ? "Editar" : "Visualizar modelo"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPreviewOpen(true)}>
            <Users size={14} />
            Pré-visualizar com associado
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || readOnly}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[6px] border border-gray-200 bg-white">
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("bold")}
              className="flex h-7 w-7 items-center justify-center rounded-[4px] text-gray-600 hover:bg-gray-200"
            >
              <Bold size={14} />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("italic")}
              className="flex h-7 w-7 items-center justify-center rounded-[4px] text-gray-600 hover:bg-gray-200"
            >
              <Italic size={14} />
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("underline")}
              className="flex h-7 w-7 items-center justify-center rounded-[4px] text-gray-600 hover:bg-gray-200"
            >
              <Underline size={14} />
            </button>
            <div className="mx-1 h-5 w-px bg-gray-300" />
            <InsertVariableMenu onInsert={insertVariable} />
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          className="prose prose-sm min-h-[480px] max-w-none px-8 py-8 text-sm leading-relaxed text-gray-800 outline-none [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2"
        />
      </div>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} size="lg">
        <ModalHeader title="Pré-visualizar com associado" onClose={() => setPreviewOpen(false)} />
        <ModalBody>
          <Select value={selectedAssociado} onChange={(e) => handlePreviewComAssociado(e.target.value)}>
            <option value="">Selecione um associado</option>
            {associadosOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome} — Nº {a.numero}
              </option>
            ))}
          </Select>

          <div className="mt-4 min-h-[300px] rounded-[6px] border border-gray-200 bg-white p-6">
            {previewLoading && <p className="text-sm text-gray-400">Carregando...</p>}
            {!previewLoading && !selectedAssociado && (
              <p className="text-sm text-gray-400">Selecione um associado para ver a prévia com os dados reais.</p>
            )}
            {!previewLoading && selectedAssociado && (
              <div
                className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-800 [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
            Fechar
          </Button>
          <div />
        </ModalFooter>
      </Modal>
    </div>
  );
}
