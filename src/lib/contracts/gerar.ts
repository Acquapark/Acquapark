import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAssociadoById } from "@/lib/supabase/associados";
import { getEmpresa, getModeloById } from "@/lib/supabase/contratos";
import { findMissingVariables, substituteVariables } from "@/lib/contracts/variables";

/** Gera a linha em `contratos_gerados` (variáveis do modelo já substituídas). Sem checagem de permissão — quem chama decide isso. */
export async function gerarContratoParaAssociado(
  supabase: SupabaseClient,
  params: { associadoId: string; modeloId: string; dataContrato: string; geradoPor: string | null },
): Promise<
  | { error: string; missing?: { key: string; label: string; group: string }[] }
  | { contratoId: string; numero: string; conteudoHtml: string; associadoNome: string; associadoEmail: string }
> {
  const [result, modelo, empresa] = await Promise.all([
    getAssociadoById(supabase, params.associadoId),
    getModeloById(supabase, params.modeloId),
    getEmpresa(supabase),
  ]);

  if (!result) return { error: "Associado não encontrado." };
  if (!modelo) return { error: "Modelo não encontrado." };

  const contratoMeta = { numero: "", data: params.dataContrato, dataInicio: params.dataContrato, dataFim: "" };

  const missing = findMissingVariables(modelo.conteudoHtml, {
    associado: result.associado,
    plano: null,
    empresa,
    contrato: contratoMeta,
  });
  if (missing.length > 0) {
    return {
      error: "O contrato possui informações obrigatórias que não foram preenchidas.",
      missing: missing.map((m) => ({ key: m.key, label: m.label, group: m.group })),
    };
  }

  const conteudoResolvido = substituteVariables(modelo.conteudoHtml, {
    associado: result.associado,
    plano: null,
    empresa,
    contrato: contratoMeta,
  });

  const { data, error } = await supabase
    .from("contratos_gerados")
    .insert({
      associado_id: params.associadoId,
      modelo_id: modelo.id,
      modelo_nome: modelo.nome,
      modelo_versao: modelo.versao,
      data_contrato: params.dataContrato,
      conteudo_html: conteudoResolvido,
      status: "Gerado",
      gerado_por: params.geradoPor,
    })
    .select("id, numero")
    .single();

  if (error || !data) return { error: error?.message ?? "Não foi possível gerar o contrato." };

  return {
    contratoId: data.id as string,
    numero: data.numero as string,
    conteudoHtml: conteudoResolvido,
    associadoNome: result.associado.nome,
    associadoEmail: result.associado.email,
  };
}

/** Modelo marcado como padrão (usado para gerar o contrato automaticamente ao cadastrar um associado), se houver um ativo. */
export async function getModeloPadrao(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("modelos_contrato")
    .select("id")
    .eq("padrao", true)
    .eq("status", "Ativo")
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
