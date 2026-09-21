"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

import { RegraPrimeiraParcela } from "@/types";

export interface PlanoFormInput {
  nome: string;
  valor: number;
  dependentesPermitidos: number;
  quantidadeMensalidades: number;
  diaVencimento: number;
  regraPrimeiraParcela: RegraPrimeiraParcela;
  vencimentoNaContratacao: boolean;
  beneficios: string[];
  ativo: boolean;
}

export async function createPlano(input: PlanoFormInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("planos").insert({
    nome: input.nome,
    valor: input.valor,
    dependentes_permitidos: input.dependentesPermitidos,
    quantidade_mensalidades: input.quantidadeMensalidades,
    dia_vencimento: input.diaVencimento,
    regra_primeira_parcela: input.regraPrimeiraParcela,
    vencimento_na_contratacao: input.vencimentoNaContratacao,
    beneficios: input.beneficios,
    ativo: input.ativo,
  });
  if (error) return { error: error.message };
  revalidatePath("/configuracoes");
  return { success: true };
}

export async function updatePlano(id: string, input: PlanoFormInput) {
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
      beneficios: input.beneficios,
      ativo: input.ativo,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes");
  return { success: true };
}
