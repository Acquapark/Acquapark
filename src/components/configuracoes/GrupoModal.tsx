"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Minus } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Input, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { ACOES_PADRAO, MODULOS, RecursoDef, TODAS_PERMISSOES } from "@/lib/permissoes";
import { useAcesso } from "@/components/providers/AcessoProvider";
import { GrupoAcesso } from "@/lib/supabase/usuarios-grupos";
import { atualizarGrupo, criarGrupo } from "@/app/(app)/configuracoes/acesso-actions";

const ROTULO_PADRAO: Record<string, string> = {
  visualizar: "Visualizar",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
};

function Caixa({
  marcado,
  parcial,
  disabled,
  onClick,
  titulo,
}: {
  marcado: boolean;
  parcial?: boolean;
  disabled?: boolean;
  onClick: () => void;
  titulo?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={parcial ? "mixed" : marcado}
      title={titulo}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        marcado || parcial ? "border-primary-600 bg-primary-600 text-white" : "border-gray-300 bg-white hover:border-primary-400",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {parcial ? <Minus size={12} /> : marcado ? <Check size={12} /> : null}
    </button>
  );
}

export function GrupoModal({
  open,
  onClose,
  grupo,
}: {
  open: boolean;
  onClose: () => void;
  /** null = novo grupo */
  grupo: GrupoAcesso | null;
}) {
  const router = useRouter();
  const { acesso, pode } = useAcesso();
  const [nome, setNome] = useState(grupo?.nome ?? "");
  const [descricao, setDescricao] = useState(grupo?.descricao ?? "");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(
    () => new Set(grupo?.acessoTotal ? TODAS_PERMISSOES : (grupo?.permissoes ?? [])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const acessoTotal = grupo?.acessoTotal ?? false;
  const podeSalvar = grupo ? pode("grupos.editar") : pode("grupos.criar");
  // Permissões só são editáveis se o usuário pode salvar e o grupo não é o de acesso total.
  const somenteLeitura = !podeSalvar || (acessoTotal && !acesso.acessoTotal);
  const matrizTravada = somenteLeitura || acessoTotal;

  /** Quem não é administrador só pode conceder o que tem; o que já estava no grupo pode sempre ser retirado. */
  function podeMarcar(chave: string) {
    return acesso.acessoTotal || pode(chave) || selecionadas.has(chave);
  }

  function alternar(recurso: RecursoDef, chave: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      const chaveCompleta = `${recurso.chave}.${chave}`;
      const visualizar = `${recurso.chave}.visualizar`;
      const temVisualizar = recurso.acoes.some((a) => a.chave === "visualizar");

      if (next.has(chaveCompleta)) {
        next.delete(chaveCompleta);
        // Sem "visualizar" não existe criar/editar/excluir/etc. do mesmo recurso.
        if (chave === "visualizar") for (const a of recurso.acoes) next.delete(`${recurso.chave}.${a.chave}`);
      } else {
        next.add(chaveCompleta);
        if (temVisualizar && chave !== "visualizar" && podeMarcar(visualizar)) next.add(visualizar);
      }
      return next;
    });
  }

  function definirLote(chaves: string[], marcar: boolean) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      for (const c of chaves) {
        if (marcar) {
          if (podeMarcar(c)) next.add(c);
        } else next.delete(c);
      }
      return next;
    });
  }

  const chavesDoModulo = useMemo(
    () =>
      Object.fromEntries(
        MODULOS.map((m) => [m.chave, m.recursos.flatMap((r) => r.acoes.map((a) => `${r.chave}.${a.chave}`))]),
      ) as Record<string, string[]>,
    [],
  );

  async function handleSave() {
    if (nome.trim().length < 2) {
      setError("Informe o nome do grupo.");
      return;
    }
    setSaving(true);
    setError("");
    const input = { nome, descricao, permissoes: [...selecionadas] };
    const result = grupo ? await atualizarGrupo(grupo.id, input) : await criarGrupo(input);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="xl">
      <ModalHeader
        title={grupo ? (somenteLeitura ? `Grupo ${grupo.nome}` : `Editar grupo — ${grupo.nome}`) : "Novo grupo"}
        subtitle="Defina o que os usuários deste grupo podem ver e fazer em cada área do sistema."
        onClose={onClose}
      />
      <ModalBody>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label required>Nome do grupo</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Supervisor de bilheteria" disabled={somenteLeitura} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Para que serve este grupo"
              className="h-9 py-1.5"
              disabled={somenteLeitura}
            />
          </div>
        </div>

        {acessoTotal && (
          <div className="mt-4 flex items-start gap-2 rounded-[4px] border border-primary-100 bg-primary-50 px-3 py-2 text-xs text-primary-700">
            <Lock size={14} className="mt-0.5 shrink-0" />
            <span>
              Este grupo tem <strong>acesso total</strong>: todas as permissões, inclusive as de funcionalidades criadas no
              futuro. Não é possível restringi-lo nem excluí-lo — isso garante que sempre haja quem administre o sistema.
            </span>
          </div>
        )}

        <div className="mb-2 mt-5 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-600">
            Permissões ({selecionadas.size} de {TODAS_PERMISSOES.length})
          </p>
          {!matrizTravada && (
            <div className="flex gap-3 text-xs">
              <button type="button" className="font-medium text-primary-700 hover:underline" onClick={() => definirLote(TODAS_PERMISSOES, true)}>
                Marcar todas
              </button>
              <button type="button" className="font-medium text-gray-500 hover:underline" onClick={() => definirLote(TODAS_PERMISSOES, false)}>
                Limpar
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-[6px] border border-gray-200">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Área</th>
                {ACOES_PADRAO.map((a) => (
                  <th key={a} className="w-24 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {ROTULO_PADRAO[a]}
                  </th>
                ))}
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Outras ações</th>
              </tr>
            </thead>
            <tbody>
              {MODULOS.map((modulo) => {
                const chaves = chavesDoModulo[modulo.chave];
                const marcadas = chaves.filter((c) => selecionadas.has(c)).length;
                const todas = marcadas === chaves.length;
                return [
                  <tr key={`modulo-${modulo.chave}`} className="border-t border-gray-200 bg-gray-50/70">
                    <td colSpan={6} className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <Caixa
                          marcado={todas}
                          parcial={!todas && marcadas > 0}
                          disabled={matrizTravada}
                          onClick={() => definirLote(chaves, !todas)}
                          titulo={todas ? "Desmarcar o módulo inteiro" : "Marcar o módulo inteiro"}
                        />
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">{modulo.rotulo}</span>
                        <span className="text-[11px] text-gray-400">
                          {marcadas}/{chaves.length}
                        </span>
                      </div>
                    </td>
                  </tr>,
                  ...modulo.recursos.map((recurso) => {
                    const outras = recurso.acoes.filter((a) => !(ACOES_PADRAO as readonly string[]).includes(a.chave));
                    return (
                      <tr key={`recurso-${recurso.chave}`} className="border-t border-gray-100 bg-white align-middle">
                        <td className="px-3 py-2 pl-9">
                          <p className="text-sm font-medium text-gray-800">{recurso.rotulo}</p>
                          {recurso.descricao && <p className="text-[11px] leading-snug text-gray-400">{recurso.descricao}</p>}
                        </td>
                        {ACOES_PADRAO.map((padrao) => {
                          const acao = recurso.acoes.find((a) => a.chave === padrao);
                          if (!acao) return <td key={padrao} className="px-2 py-2 text-center text-gray-300">—</td>;
                          const chave = `${recurso.chave}.${padrao}`;
                          const renomeada = acao.rotulo !== ROTULO_PADRAO[padrao];
                          return (
                            <td key={padrao} className="px-2 py-2">
                              <div className="flex flex-col items-center gap-0.5">
                                <Caixa
                                  marcado={selecionadas.has(chave)}
                                  disabled={matrizTravada || !podeMarcar(chave)}
                                  onClick={() => alternar(recurso, padrao)}
                                  titulo={acao.descricao ?? acao.rotulo}
                                />
                                {renomeada && <span className="text-center text-[10px] leading-tight text-gray-500">{acao.rotulo}</span>}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2">
                          {outras.length === 0 ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {outras.map((acao) => {
                                const chave = `${recurso.chave}.${acao.chave}`;
                                const ativa = selecionadas.has(chave);
                                const bloqueada = matrizTravada || !podeMarcar(chave);
                                return (
                                  <button
                                    key={chave}
                                    type="button"
                                    role="checkbox"
                                    aria-checked={ativa}
                                    disabled={bloqueada}
                                    title={acao.descricao ?? acao.rotulo}
                                    onClick={() => alternar(recurso, acao.chave)}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-xs transition-colors",
                                      ativa
                                        ? "border-primary-600 bg-primary-50 text-primary-700"
                                        : "border-gray-300 bg-white text-gray-500 hover:border-primary-400",
                                      bloqueada && "cursor-not-allowed opacity-50",
                                    )}
                                  >
                                    {ativa && <Check size={11} />}
                                    {acao.rotulo}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Criar, editar, excluir e as demais ações exigem poder visualizar a área — marcá-las liga “Visualizar” sozinho.
          {!acesso.acessoTotal && " Você só consegue conceder permissões que o seu grupo também possui."}
        </p>

        {error && (
          <div className="mt-4 rounded-[4px] border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          {somenteLeitura ? "Fechar" : "Cancelar"}
        </Button>
        {!somenteLeitura && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
