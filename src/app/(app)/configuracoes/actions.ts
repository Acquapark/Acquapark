"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

import { RegraPrimeiraParcela } from "@/types";
import { exigirPermissao } from "@/lib/auth/acesso-atual";

export interface PlanoFormInput {
  nome: string;
  valor: number;
  dependentesPermitidos: number;
  quantidadeMensalidades: number;
  diaVencimento: number;
  regraPrimeiraParcela: RegraPrimeiraParcela;
  vencimentoNaContratacao: boolean;
  disponivelAutocadastro: boolean;
  beneficios: string[];
  ativo: boolean;
}

export async function createPlano(input: PlanoFormInput) {
  const negado = await exigirPermissao("planos.criar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.from("planos").insert({
    nome: input.nome,
    valor: input.valor,
    dependentes_permitidos: input.dependentesPermitidos,
    quantidade_mensalidades: input.quantidadeMensalidades,
    dia_vencimento: input.diaVencimento,
    regra_primeira_parcela: input.regraPrimeiraParcela,
    vencimento_na_contratacao: input.vencimentoNaContratacao,
    disponivel_autocadastro: input.disponivelAutocadastro,
    beneficios: input.beneficios,
    ativo: input.ativo,
  });
  if (error) return { error: error.message };
  revalidatePath("/configuracoes");
  return { success: true };
}

export async function updatePlano(id: string, input: PlanoFormInput) {
  const negado = await exigirPermissao("planos.editar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("planos")
    .update({
      nome: input.nome,
      valor: input.valor,
      dependentes_permitidos: input.dependentesPermitidos,
      quantidade_mensalidades: input.quantidadeMensalidades,
      dia_vencimento: input.diaVencimento,
      regra_primeira_parcela: input.regraPrimeiraParcela,
      vencimento_na_contratacao: input.vencimentoNaContratacao,
      disponivel_autocadastro: input.disponivelAutocadastro,
      beneficios: input.beneficios,
      ativo: input.ativo,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes");
  return { success: true };
}

/** Liga/desliga o contrato automático (documento para assinatura enviado no cadastro). */
export async function salvarContratoAutomatico(ligado: boolean) {
  const negado = await exigirPermissao("parque.editar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.from("empresa").update({ contrato_automatico: ligado }).eq("id", true);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes");
  return { success: true };
}

/**
 * Publica uma nova versão dos termos de adesão. Versões publicadas nunca são
 * editadas: cada mudança vira uma versão nova, e todo associado precisa
 * aceitá-la no próximo acesso ao Portal.
 */
export async function publicarTermos(conteudo: string) {
  const negado = await exigirPermissao("termos.publicar");
  if (negado) return { error: negado.error };
  const texto = conteudo.trim();
  if (texto.length < 20) return { error: "Escreva o texto dos termos antes de publicar." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: ultima } = await supabase
    .from("termos_versoes")
    .select("versao, conteudo")
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultima && (ultima.conteudo as string).trim() === texto) {
    return { error: "O texto é igual ao da versão em vigor — nada para publicar." };
  }

  const { error } = await supabase.from("termos_versoes").insert({
    versao: ((ultima?.versao as number) ?? 0) + 1,
    conteudo: texto,
    publicado_por: user?.id ?? null,
  });
  if (error) return { error: error.code === "23505" ? "Outra versão acabou de ser publicada. Recarregue a página." : error.message };

  revalidatePath("/configuracoes");
  return { success: true };
}
